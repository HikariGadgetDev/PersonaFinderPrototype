// =============================================================
// SilentGuardian v3
// Homebrew Anti-BOT Framework
// 完全版：Options / Debug / Hooks / Stats / Rate Limit / Timeout
// =============================================================
//
// 💬 このスクリプトの位置づけ
// -------------------------------------------------
// - Cloudflare / Netlify / WAF のような「インフラ側の防御」を
//   置き換えるものではなく、アプリケーション層に置く
//   “行動ベースの BOT 検知レイヤー” です。
// - 目的は「WebDriver + 機械的なマウス・キーボード・スクロール」
//   の特徴を拾い、必要なら軽いチャレンジ（slider / emoji）で
//   人間確認をかけること。
// - Defense in Depth（多層防御）のうち、
//     * フィンガープリント（パッシブ）
//     * 行動トラッキング（アクティブ）
//     * 軽量チャレンジ
//   を 1 クラスの中にまとめた “小さな実験フレームワーク” です。
// - 「これだけで完全防御」は目指しておらず、
//   「安い BOT をふるい落としつつ、人間にはできる限り優しく」
//   というバランスに振っています。
// =============================================================

class SilentGuardian {
  constructor(options = {}) {
    // ---------------------------------------------
    // Config (全てオプション化)
    // ---------------------------------------------
    //
    // - thresholds: Suspicion スコアの評価ライン
    // - minSamples: 行動分析に必要な最小サンプル数
    // - suspicionWeights: 各シグナルごとの加点量
    // - challengeTimeout: チャレンジ UI のタイムアウト
    // - rateLimitWindow / maxVerifyPerWindow: verify() の濫用制限
    // - debug: 内部ログの出力フラグ
    //
    // 呼び出し側から options で上書き可能にしているので、
    // プロファイルごとに感度を変えられる。
    this.config = {
      thresholds: {
        low: options.lowThreshold || 30,
        medium: options.mediumThreshold || 50,
        high: options.highThreshold || 70
      },
      minSamples: {
        mouse: options.minMouseSamples || 20,
        keyboard: options.minKeyboardSamples || 10
      },
      suspicionWeights: {
        webdriver: options.webdriverWeight || 30,
        canvasError: options.canvasErrorWeight || 10,
        webglError: options.webglErrorWeight || 10,
        lowFonts: options.lowFontsWeight || 10,
        oneCore: options.oneCoreWeight || 10,
        straightMouse: options.straightMouseWeight || 10,
        evenMouseSpeed: options.evenMouseSpeedWeight || 10,
        superFastTyping: options.superFastTypingWeight || 15,
        evenTyping: options.evenTypingWeight || 10,
        noScrollStops: options.noScrollStopsWeight || 5
      },
      challengeTimeout: options.challengeTimeout || 30000,
      rateLimitWindow: options.rateLimitWindow || 60000,
      maxVerifyPerWindow: options.maxVerifyPerWindow || 5,
      debug: options.debug || false
    };

    // ---------------------------------------------
    // Hooks
    // ---------------------------------------------
    //
    // - onSuspicionChange: スコア変化時の通知
    // - onChallengeStart / onChallengeEnd: チャレンジ開始/終了
    // - onBotDetected: BOT 最終判定時
    // - onVerify: verify() 実行時
    //
    // → 外側のアプリ側で UI 連携やログ送信などを差し込むための拡張ポイント。
    this.hooks = {
      onSuspicionChange: options.onSuspicionChange || null,
      onChallengeStart: options.onChallengeStart || null,
      onChallengeEnd: options.onChallengeEnd || null,
      onBotDetected: options.onBotDetected || null,
      onVerify: options.onVerify || null
    };

    // ---------------------------------------------
    // Internal State
    // ---------------------------------------------
    //
    // - suspicionScore: 0〜100 の BOT 疑惑スコア
    // - fingerprint: レイヤー1のハッシュ値
    // - behaviors: マウス / キー / スクロールの生ログ
    //
    // verify() 毎に蓄積された状態を使って判定する。
    this.suspicionScore = 0;
    this.fingerprint = null;
    this.behaviors = { mouse: [], keyboard: [], scroll: [] };

    // verify() レートリミット用
    this.lastVerifyTime = 0;
    this.verifyCount = 0;
  }

  // =============================================================
  // Utility: Score handling
  // =============================================================
  _addSuspicion(v, reason = "unknown") {
    const old = this.suspicionScore;
    this.suspicionScore = Math.min(this.suspicionScore + v, 100);

    if (this.config.debug) {
      console.log(`[SG] +${v} suspicion (${old} → ${this.suspicionScore}): ${reason}`);
    }

    if (this.hooks.onSuspicionChange) {
      this.hooks.onSuspicionChange({
        old,
        new: this.suspicionScore,
        delta: v,
        reason
      });
    }
  }

  // =============================================================
  // Layer 1: Passive Fingerprinting
  // =============================================================
  //
  // - ブラウザの「静的な特徴」から不自然さを拾うレイヤー。
  //   * canvas fingerprint の取得エラー
  //   * WebGL の未サポート/エラー
  //   * フォント数が極端に少ない
  //   * hardwareConcurrency が 1 など
  //
  // - navigator.webdriver など、典型的な BOT 指標もここで加点。
  //
  // - これ単体で「BOT 確定」は目指さず、
  //   行動トラッキングと合わせて総合スコアを出す。

  async generateFingerprint() {
    const fp = {
      canvas: this._canvasFingerprint(),
      webgl: this._webglFingerprint(),
      audio: await this._audioFingerprint(),
      fonts: this._fontFingerprint(),
      hardware: this._hardwareFingerprint(),
      timezone: this._timezoneFingerprint()
    };

    this.fingerprint = await this._hash(JSON.stringify(fp));
    this._analyzeFingerprint(fp);

    return this.fingerprint;
  }

  _canvasFingerprint() {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return "error";

      ctx.textBaseline = "top";
      ctx.font = '14px "Arial"';
      ctx.fillStyle = "#f60";
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = "#069";
      ctx.fillText("SilentGuardian", 2, 15);

      return canvas.toDataURL();
    } catch {
      return "error";
    }
  }

  _webglFingerprint() {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

      if (!gl) return "unsupported";

      const debug = gl.getExtension("WEBGL_debug_renderer_info");
      if (!debug) {
        return {
          vendor: null,
          renderer: null,
          version: gl.getParameter(gl.VERSION)
        };
      }

      return {
        vendor: gl.getParameter(debug.UNMASKED_VENDOR_WEBGL),
        renderer: gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
        version: gl.getParameter(gl.VERSION)
      };
    } catch {
      return "error";
    }
  }

  async _audioFingerprint() {
    let ctx;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      const sampleRate = ctx.sampleRate;
      const channels = ctx.destination.channelCount;
      await ctx.close();
      return { sampleRate, channels };
    } catch {
      return "unsupported";
    }
  }

  _fontFingerprint() {
    const base = ["monospace", "sans-serif", "serif"];
    const test = ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia"];

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const text = "mmmmmmmmlli";

    const baseWidth = {};
    base.forEach(bf => {
      ctx.font = `72px ${bf}`;
      baseWidth[bf] = ctx.measureText(text).width;
    });

    const detected = [];
    test.forEach(font => {
      base.forEach(b => {
        ctx.font = `72px ${font}, ${b}`;
        if (ctx.measureText(text).width !== baseWidth[b]) detected.push(font);
      });
    });

    return detected;
  }

  _hardwareFingerprint() {
    return {
      cores: navigator.hardwareConcurrency || null,
      memory: navigator.deviceMemory || null,
      ua: navigator.userAgent,
      platform: navigator.platform,
      languages: navigator.languages
    };
  }

  _timezoneFingerprint() {
    const opt = Intl.DateTimeFormat().resolvedOptions();
    return {
      timezone: opt.timeZone,
      locale: opt.locale,
      offset: new Date().getTimezoneOffset()
    };
  }

  _analyzeFingerprint(fp) {
    if (navigator.webdriver)
      this._addSuspicion(this.config.suspicionWeights.webdriver, "webdriver detected");

    if (fp.canvas === "error")
      this._addSuspicion(this.config.suspicionWeights.canvasError, "canvas error");

    if (fp.webgl === "unsupported" || fp.webgl === "error")
      this._addSuspicion(this.config.suspicionWeights.webglError, "webgl unsupported");

    if (fp.fonts.length < 3)
      this._addSuspicion(this.config.suspicionWeights.lowFonts, "few fonts detected");

    if (fp.hardware.cores === 1)
      this._addSuspicion(this.config.suspicionWeights.oneCore, "1 core device");
  }

  // =============================================================
  // Layer 2: Behavioral Tracking & Analysis
  // =============================================================
  //
  // マウス・キーボード・スクロールの「時間変化」を見るレイヤー。
  //
  // - マウス:
  //    * 角度変化が小さすぎる → 直線的すぎる
  //    * 速度の分散が小さすぎる → 一定速度すぎる
  //
  // - キーボード:
  //    * 平均キー間隔が短すぎる → 超高速タイピング
  //    * 分散が小さすぎる → 間隔が機械的
  //
  // - スクロール:
  //    * 停止がほとんどない → 均一スクロール
  //
  // 「人間ぽさ」というより、“明らかに機械的な挙動” を検知して加点していく。

  trackMouse(e) {
    this.behaviors.mouse.push({
      x: e.clientX,
      y: e.clientY,
      t: performance.now()
    });

    if (this.behaviors.mouse.length > 150) this.behaviors.mouse.shift();
    if (this.behaviors.mouse.length >= this.config.minSamples.mouse)
      this._analyzeMouse();
  }

  _analyzeMouse() {
    const m = this.behaviors.mouse;

    // 角度変化
    let angleSum = 0;
    for (let i = 2; i < m.length; i++) {
      const a1 = Math.atan2(m[i - 1].y - m[i - 2].y, m[i - 1].x - m[i - 2].x);
      const a2 = Math.atan2(m[i].y - m[i - 1].y, m[i].x - m[i - 1].x);
      angleSum += Math.abs(a2 - a1);
    }
    if (angleSum < 0.5)
      this._addSuspicion(
        this.config.suspicionWeights.straightMouse,
        "mouse movement too straight"
      );

    // 速度分散
    const speeds = [];
    for (let i = 1; i < m.length; i++) {
      const dx = m[i].x - m[i - 1].x;
      const dy = m[i].y - m[i - 1].y;
      const dt = m[i].t - m[i - 1].t;
      speeds.push(Math.hypot(dx, dy) / dt);
    }

    const avg = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance =
      speeds.reduce((s, v) => s + (v - avg) ** 2, 0) / speeds.length;

    if (variance < 0.1)
      this._addSuspicion(
        this.config.suspicionWeights.evenMouseSpeed,
        "mouse speed too constant"
      );
  }

  trackKeyboard(e) {
    this.behaviors.keyboard.push({
      key: e.key,
      t: performance.now()
    });

    if (this.behaviors.keyboard.length > 60) this.behaviors.keyboard.shift();
    if (this.behaviors.keyboard.length >= this.config.minSamples.keyboard)
      this._analyzeKeyboard();
  }

  _analyzeKeyboard() {
    const kb = this.behaviors.keyboard;

    const intervals = [];
    for (let i = 1; i < kb.length; i++) {
      intervals.push(kb[i].t - kb[i - 1].t);
    }

    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    if (avg < 50)
      this._addSuspicion(
        this.config.suspicionWeights.superFastTyping,
        "typing too fast"
      );

    const variance =
      intervals.reduce((s, v) => s + (v - avg) ** 2, 0) / intervals.length;
    if (variance < 10)
      this._addSuspicion(
        this.config.suspicionWeights.evenTyping,
        "typing intervals too uniform"
      );
  }

  trackScroll() {
    this.behaviors.scroll.push({
      y: window.scrollY,
      t: performance.now()
    });

    if (this.behaviors.scroll.length > 60) this.behaviors.scroll.shift();
    this._analyzeScroll();
  }

  _analyzeScroll() {
    const s = this.behaviors.scroll;
    if (s.length < 10) return;

    let stops = 0;
    for (let i = 1; i < s.length; i++) {
      if (Math.abs(s[i].y - s[i - 1].y) < 2) stops++;
    }

    const ratio = stops / s.length;
    if (ratio < 0.1)
      this._addSuspicion(
        this.config.suspicionWeights.noScrollStops,
        "scroll too uniform"
      );
  }

  // =============================================================
  // Layer 3: Challenge (with timeout)
  // =============================================================
  //
  // Suspicion スコアが閾値を超えたときに発動する、
  // 軽めの「人間チャレンジ」レイヤー。
  //
  // - スコアが high 未満なら slider チャレンジ
  // - high 以上なら emoji チャレンジ
  //
  // challengeTimeout によるタイムアウト判定を持ち、
  // ユーザーが応答しない場合も「失敗」と見なす。

  async challenge() {
    if (this.hooks.onChallengeStart)
      this.hooks.onChallengeStart({ score: this.suspicionScore });

    const challengePromise =
      this.suspicionScore < this.config.thresholds.high
        ? this._challengeSlider()
        : this._challengeEmoji();

    const timeoutPromise = new Promise(resolve =>
      setTimeout(
        () => resolve({ passed: false, method: "timeout", reason: "timeout" }),
        this.config.challengeTimeout
      )
    );

    const result = await Promise.race([challengePromise, timeoutPromise]);

    if (this.hooks.onChallengeEnd) this.hooks.onChallengeEnd(result);

    return result;
  }

  _challengeSlider() {
    return new Promise(resolve => {
      const overlay = this._createOverlay(`
        <p>スライダーを右端まで動かしてください</p>
        <input type="range" min="0" max="100" value="0" class="sg-slider" style="width:300px">
      `);

      const slider = overlay.querySelector(".sg-slider");
      const start = performance.now();

      slider.addEventListener("input", e => {
        if (e.target.value === "100") {
          const duration = performance.now() - start;
          overlay.remove();
          resolve({ passed: duration > 500, method: "slider", duration });
        }
      });
    });
  }

  _challengeEmoji() {
    return new Promise(resolve => {
      const images = ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊"];
      const target = images[Math.floor(Math.random() * images.length)];

      const overlay = this._createOverlay(`
        <p>${target} を選んでください</p>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px">
          ${images
            .map(
              img =>
                `<button data-img="${img}" style="font-size:40px; padding:10px">${img}</button>`
            )
            .join("")}
        </div>
      `);

      overlay.addEventListener("click", e => {
        if (e.target.dataset.img) {
          const pass = e.target.dataset.img === target;
          overlay.remove();
          resolve({ passed: pass, method: "emoji", target });
        }
      });
    });
  }

  _createOverlay(inner) {
    const overlay = document.createElement("div");
    overlay.style = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.7);
      display:flex; align-items:center; justify-content:center;
      z-index: 999999;
    `;
    overlay.innerHTML = `
      <div style="background:white; padding:25px; border-radius:10px;">
        ${inner}
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  // =============================================================
  // verify() with rate limit, threshold logic, hooks
  // =============================================================
  //
  // - 入口メソッド。
  // - レートリミット → 指紋生成 → サンプル量チェック →
  //   閾値判定 → 必要ならチャレンジ → 最終判定
  //
  // - Cloudflare などの WAF とは独立した「クライアント側の自己診断」として
  //   フロントに置くことを想定している。

  async verify() {
    const now = Date.now();

    // Rate limiting
    if (now - this.lastVerifyTime > this.config.rateLimitWindow) {
      this.verifyCount = 0;
    }

    this.verifyCount++;
    this.lastVerifyTime = now;

    if (this.verifyCount > this.config.maxVerifyPerWindow) {
      const res = {
        isBot: true,
        reason: "rate_limit_exceeded",
        confidence: "high"
      };
      if (this.hooks.onBotDetected) this.hooks.onBotDetected(res);
      return res;
    }

    if (this.hooks.onVerify) this.hooks.onVerify();

    await this.generateFingerprint();

    // 行動データ不足
    if (this.behaviors.mouse.length < this.config.minSamples.mouse)
      this._addSuspicion(10, "insufficient mouse samples");

    if (this.behaviors.keyboard.length < this.config.minSamples.keyboard)
      this._addSuspicion(10, "insufficient keyboard samples");

    // スコア判定
    if (this.suspicionScore < this.config.thresholds.low)
      return { isBot: false, confidence: "high" };

    if (this.suspicionScore < this.config.thresholds.medium)
      return { isBot: false, confidence: "medium" };

    // Challenge
    const result = await this.challenge();
    if (!result.passed) {
      const out = {
        isBot: true,
        confidence: "high",
        reason: "challenge_failed",
        detail: result
      };
      if (this.hooks.onBotDetected) this.hooks.onBotDetected(out);
      return out;
    }

    return { isBot: false, confidence: "low", challenged: true };
  }

  // =============================================================
  // Stats API
  // =============================================================
  //
  // 外部から「今どういう状態か」を覗き見るための軽量 API。
  // - suspicionScore
  // - fingerprint（SHA-256）
  // - 各行動ログのサンプル数
  getStats() {
    return {
      suspicionScore: this.suspicionScore,
      fingerprint: this.fingerprint,
      samples: {
        mouse: this.behaviors.mouse.length,
        keyboard: this.behaviors.keyboard.length,
        scroll: this.behaviors.scroll.length
      }
    };
  }

  // =============================================================
  // Hash util
  // =============================================================
  //
  // Fingerprint オブジェクトを SHA-256 に畳み込むためのユーティリティ。
  async _hash(str) {
    const data = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest("SHA-256", data);
    return [...new Uint8Array(buf)]
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

// =============================================================
// Usage Example
// =============================================================
//
// - デフォルトでは debug: true でログを出す例。
// - 実運用では SG_PROFILES 経由でモードを選んで生成する想定。
// - この下は “サンプル用” のコードなので、実際のアプリ側では
//   createGuardian() を使ってインスタンスを作ると綺麗に分離できる。

const guardian = new SilentGuardian({
  debug: true,
  onSuspicionChange: info =>
    console.log(`Suspicion changed: ${info.old} → ${info.new} (${info.reason})`),
  onBotDetected: info => console.warn("BOT DETECTED", info),
  onChallengeStart: info => console.log("Challenge started", info),
  onChallengeEnd: info => console.log("Challenge result", info)
});

// 行動監視
document.addEventListener("mousemove", e => guardian.trackMouse(e), { passive: true });
document.addEventListener("keydown", e => guardian.trackKeyboard(e), { passive: true });
document.addEventListener("scroll", () => guardian.trackScroll(), { passive: true });

// トリガーボタン
const btn = document.querySelector(".js-verify");
if (btn) {
  btn.addEventListener("click", async () => {
    const res = await guardian.verify();
    console.log("VERIFY RESULT:", res);
  });
}

// =============================================================
// プロファイル定義
// =============================================================
//
// - naive: 行動系シグナルをほぼ無視して、webdriver などの
//          明確な指標のみを見る “ゆるい” モード。
// - advanced: 行動系までちゃんと見る “厳しめ” モード。
// -------------------------------------------------------------

const SG_PROFILES = {
  naive: {
    debug: false,
    lowThreshold: 40,
    mediumThreshold: 70,
    webdriverWeight: 50,
    // 行動系はかなり軽め
    straightMouseWeight: 0,
    evenMouseSpeedWeight: 0,
    superFastTypingWeight: 0,
    evenTypingWeight: 0,
    noScrollStopsWeight: 0,
    challengeTimeout: 15000
  },
  advanced: {
    debug: true,
    lowThreshold: 30,
    mediumThreshold: 50,
    webdriverWeight: 30,
    straightMouseWeight: 10,
    evenMouseSpeedWeight: 10,
    superFastTypingWeight: 15,
    evenTypingWeight: 10,
    noScrollStopsWeight: 5,
    challengeTimeout: 30000
  }
};

// =============================================================
// Factory: プロファイルから Guardian を生成するヘルパー
// =============================================================
function createGuardian(mode = "naive", extraOptions = {}) {
  const base = SG_PROFILES[mode] || SG_PROFILES.naive;
  return new SilentGuardian({ ...base, ...extraOptions });
}
