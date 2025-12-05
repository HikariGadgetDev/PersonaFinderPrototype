// ==========================================
// footer.js - シンプル版（BOT対策なし / Config分離）
//
// 役割:
//  - フッターDOMの生成・挿入
//  - Base64 + 反転 + ROT13 トリプル難読化デコード（主に GitHub URL 用）
//  - メールアドレスの動的分割エンコード（4パーツ Base64 → 逆順結合）
//  - スムーススクロール (#アンカー用)
//  - prefers-reduced-motion を考慮したフェードインアニメーション
//  - target="_blank" リンクへの noopener / noreferrer 付与
//
// 設計ポイント:
//  - サイト固有の値（GitHub URL / メールエンコード / フラグ）は
//    window.FOOTER_CONFIG（footer.config.js）に寄せる。
//    → footer.js は「共通ライブラリ」として他プロジェクトにも再利用可能。
//  - Cloudflare / Netlify / WAF などの“インフラ側の防御”とは別レイヤー。
//    ここでやっているのは、あくまで
//      「メールやURLをHTMLに生で置かない」
//      「雑なクローラー / スパムBOTへの現実的なコスト増」
//    というアプリケーション層の薄い防御（defense in depth の一段）。
//  - BOT検知・行動トラッキング・ハニーポット等は一切含めていない。
//    “UIと軽い難読化だけ” に絞ったバージョン。
// ==========================================

/**
 * @typedef {Object} FooterEmailParts
 * @property {string} p1 - local-part 前半 (Base64 / reversed)
 * @property {string} p2 - local-part 後半 (Base64 / reversed)
 * @property {string} p3 - domain 名 (例: "gmail" を Base64 / reversed で保持)
 * @property {string} p4 - TLD (例: "com" を Base64 / reversed で保持)
 */

/**
 * @typedef {Object} FooterConfig
 * @property {string} githubEncoded  - ROT13 + Base64 + reverse で難読化した GitHub URL
 * @property {FooterEmailParts} emailParts - メールアドレスを構成する Base64 パーツ
 * @property {boolean} [enableAnimation]   - フェードインアニメーションを有効にするか
 * @property {boolean} [enableSmoothScroll] - #リンクのスムーススクロールを有効にするか
 * @property {boolean} [debug]             - デバッグログ出力のフラグ
 */

(function (global) {
  'use strict';

  // ==========================================
  // 設定マージ（FOOTER_CONFIG + デフォルト）
  // ==========================================

  // footer.config.js 側で定義されている想定。
  // 例:
  //   /** @type {FooterConfig} *\/
  //   global.FOOTER_CONFIG = {
  //     githubEncoded: '...',
  //     emailParts: { p1: '...', p2: '...', p3: '...', p4: '...' },
  //     enableAnimation: true,
  //     enableSmoothScroll: true,
  //     debug: false
  //   };
  /** @type {FooterConfig|undefined} */
  const SITE_CONFIG = global.FOOTER_CONFIG || {};

  const CONFIG = Object.freeze({
    currentYear: new Date().getFullYear(),

    // トリプル難読化された GitHub URL
    // - footer.config.js 側で githubEncoded を渡せばそちらを優先
    // - 何も渡さなければ、ここに書かれたデフォルト値を使う
    githubEncoded:
      SITE_CONFIG.githubEncoded ||
      'MKO5qT90o3WDpzIxozyTLJ5ip3WyHP92MHE0MJqxLHqcpzSenHtioJ9wYzW1nUEcMl8iBaAjqUEb',

    // 将来の拡張用（現状未使用だが、型として保持）
    mailEncoded: SITE_CONFIG.mailEncoded || 'VT1iLl5fnJSgM0O2MJEuq2Seo3W1n2t=',

    // 動き系
    enableAnimation:
      typeof SITE_CONFIG.enableAnimation === 'boolean'
        ? SITE_CONFIG.enableAnimation
        : true,

    enableSmoothScroll:
      typeof SITE_CONFIG.enableSmoothScroll === 'boolean'
        ? SITE_CONFIG.enableSmoothScroll
        : true,

    // デバッグフラグ：
    //  - FOOTER_CONFIG.debug が boolean ならそれを優先
    //  - そうでなければ localhost / 127.0.0.1 / ?footerDebug=true で有効化
    debug: (function () {
      if (typeof SITE_CONFIG.debug === 'boolean') {
        return SITE_CONFIG.debug;
      }
      try {
        const host = global.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') return true;
        const params = new URLSearchParams(global.location.search);
        if (params.get('footerDebug') === 'true') return true;
      } catch (e) {
        // ignore
      }
      return false;
    })()
  });

  // メールアドレスの Base64 パーツ（footer.config.js からも上書き可能）
  /** @type {FooterEmailParts|Object<string,string>} */
  const emailConfig = SITE_CONFIG.emailParts || {};

  const EmailParts = {
    // 例: "hkurakawa" / "dev" / "gmail" / "com" のようなものを逆順で持っている
    p1: emailConfig.p1 || 'aGt1cm9rYXdh',
    p2: emailConfig.p2 || 'ZGV2',
    p3: emailConfig.p3 || 'Z21haWw=',
    p4: emailConfig.p4 || 'Y29t',

    construct() {
      try {
        const parts = [
          global.atob(this.p1).split('').reverse().join(''),
          global.atob(this.p2).split('').reverse().join(''),
          global.atob(this.p3).split('').reverse().join(''),
          global.atob(this.p4).split('').reverse().join('')
        ];

        const email = `${parts[0]}${parts[1]}@${parts[2]}.${parts[3]}`;

        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(email)) {
          throw new Error('Invalid email');
        }

        log('Email dynamically constructed', 'info');
        return email;
      } catch (e) {
        log('Email construction failed: ' + e.message, 'error');
        return null;
      }
    }
  };

  // ==========================================
  // デバッグログ
  // ==========================================
  function log(message, level) {
    if (!CONFIG.debug) return;
    const prefix = '[Footer]';
    const lvl = level || 'info';
    const logger = global.console[lvl] || global.console.log;
    logger(prefix + ' ' + message);
  }

  // ==========================================
  // 暗号化ユーティリティ
  // ==========================================

  /**
   * ROT13 暗号化（シーザー暗号）
   *
   * - a-z, A-Z の文字だけを13文字ずらす。
   * - ここでは「難読化の一段階」として使用しており、
   *   セキュリティの本命ではない。
   * @param {string} str
   * @returns {string}
   */
  function rot13(str) {
    return str.replace(/[a-zA-Z]/g, function (c) {
      const base = c <= 'Z' ? 65 : 97;
      return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
    });
  }

  /**
   * トリプル難読化デコード（Base64 + 反転 + ROT13）
   *
   * 変換流れ:
   *   1. ROT13 → 元の Base64 文字列へ
   *   2. atob → プレーンテキスト
   *   3. reverse → 最終的な文字列 (URL / email)
   *
   * type === 'url' のときは new URL() で最低限の形式チェックを実施。
   * type === 'email' のときは簡易メール正規表現で検証。
   *
   * @param {string} encoded
   * @param {'url'|'email'} type
   * @returns {string|null}
   */
  function tripleDecodeSecure(encoded, type) {
    try {
      const rot13Decoded = rot13(encoded);
      const base64Decoded = decodeURIComponent(
        escape(global.atob(rot13Decoded))
      );
      const reversed = base64Decoded.split('').reverse().join('');

      if (type === 'url') {
        // URL として最低限の整合性チェック
        // （ここで例外が出たら decode 失敗扱い）
        // eslint-disable-next-line no-new
        new URL(reversed);
      } else if (type === 'email') {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!re.test(reversed)) {
          throw new Error('Invalid email format');
        }
      }

      log('Triple decode successful: ' + type, 'info');
      return reversed;
    } catch (e) {
      log('Triple decode failed: ' + e.message, 'error');
      return null;
    }
  }

  // ==========================================
  // フッターHTMLテンプレート
  // ==========================================
  function getFooterTemplate() {
    return (
      '<footer class="footer" role="contentinfo">' +
        '<div class="footer__container">' +
          '<div class="footer__top">' +
            '<div class="footer__brand">' +
              '<a href="index.html" class="footer__logo" aria-label="Persona Finder ホームに戻る">' +
                '<div class="footer__logo-icon">Ψ</div>' +
                '<span class="footer__logo-text">Persona Finder</span>' +
              '</a>' +
              '<p class="footer__tagline">透明な理論の中で、あなた自身を見出す</p>' +
            '</div>' +
            '<nav class="footer__nav" aria-label="フッターナビゲーション">' +
              '<div class="footer__nav-column">' +
                '<h4 class="footer__nav-title">診断ツール</h4>' +
                '<ul class="footer__nav-list">' +
                  '<li><a href="finder.html?mode=simple" class="footer__nav-link">簡易診断</a></li>' +
                  '<li><a href="finder.html?mode=standard" class="footer__nav-link">通常診断</a></li>' +
                  '<li><a href="finder.html?mode=detail" class="footer__nav-link">詳細診断</a></li>' +
                '</ul>' +
              '</div>' +
              '<div class="footer__nav-column">' +
                '<h4 class="footer__nav-title">理論について</h4>' +
                '<ul class="footer__nav-list">' +
                  '<li><a href="function.html" class="footer__nav-link">8つの機能</a></li>' +
                  '<li><a href="index.html#types" class="footer__nav-link">16のタイプ</a></li>' +
                  '<li><a href="description.html" class="footer__nav-link">ソースコード解説（未実装）</a></li>' +
                '</ul>' +
              '</div>' +
              '<div class="footer__nav-column">' +
                '<h4 class="footer__nav-title">リソース</h4>' +
                '<ul class="footer__nav-list">' +
                  '<li>' +
                    '<a href="#" class="footer__nav-link footer__nav-link--external js-github"' +
                      ' target="_blank" rel="noopener noreferrer"' +
                      ' aria-label="GitHubリポジトリを開く（新しいタブ）">' +
                      'GitHub<span class="footer__nav-icon" aria-hidden="true">↗</span>' +
                    '</a>' +
                  '</li>' +
                  '<li>' +
                    '<a href="#" class="footer__nav-link js-contact" aria-label="お問い合わせメールを送る">' +
                      'お問い合わせ' +
                    '</a>' +
                  '</li>' +
                  '<li>' +
                    '<a href="privacy.html" class="footer__nav-link" aria-label="プライバシーポリシーを読む">' +
                      'プライバシー' +
                    '</a>' +
                  '</li>' +
                '</ul>' +
              '</div>' +
            '</nav>' +
          '</div>' +
          '<div class="footer__divider" aria-hidden="true"></div>' +
          '<div class="footer__bottom">' +
            '<div class="footer__quote">' +
              '<blockquote class="footer__quote-text">' +
                '<p>"真理への道は、正しい理論を盲信することではなく、誤った理論を誠実に検証し、より良いものへと進むことにある。"</p>' +
              '</blockquote>' +
            '</div>' +
            '<div class="footer__meta">' +
              '<p class="footer__disclaimer">' +
                '本診断ツールは MBTI 理論およびユング心理学を参考に独自開発したものであり、<br class="hide-mobile">' +
                'Mentuzzle・16Personalities・The Myers-Briggs Company 等の公式サービスとは一切関係ありません。' +
              '</p>' +
              '<p class="footer__copyright">' +
                '© <time datetime="' + CONFIG.currentYear + '" class="footer__copyright-year">' +
                  CONFIG.currentYear +
                '</time> Persona Finder · ' +
                'Licensed for academic and educational use (CC BY-NC-SA 4.0).<br>' +
                'For commercial licensing or redistribution inquiries, please ' +
                '<a href="#" class="footer__copyright-link js-mail">click here</a>.' +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div class="footer__glow" aria-hidden="true"></div>' +
        '</div>' +
      '</footer>'
    );
  }

  function getFallbackTemplate() {
    return (
      '<footer class="footer footer--fallback" role="contentinfo">' +
        '<div class="footer__container">' +
          '<div class="footer__meta">' +
            '<p class="footer__copyright">© ' + CONFIG.currentYear + ' Persona Finder</p>' +
          '</div>' +
        '</div>' +
      '</footer>'
    );
  }

  // ==========================================
  // 挿入処理
  // ==========================================
  function injectFooter() {
    log('Injection started');

    try {
      var existingFooter = document.querySelector('.footer:not(.footer--noscript)');
      if (existingFooter) {
        existingFooter.parentNode.removeChild(existingFooter);
        log('Existing footer removed');
      }

      document.body.insertAdjacentHTML('beforeend', getFooterTemplate());
      log('Footer HTML injected');

      var footer = document.querySelector('.footer');
      if (!footer) {
        throw new Error('Footer injection failed');
      }

      initializeFooter(footer);
      log('Footer initialized successfully');
      return true;
    } catch (error) {
      log('Injection failed: ' + error.message, 'error');

      try {
        var noscriptFooter = document.querySelector('.footer--noscript');
        if (noscriptFooter) {
          noscriptFooter.style.display = 'block';
          log('Noscript footer displayed', 'warn');
          return true;
        }

        document.body.insertAdjacentHTML('beforeend', getFallbackTemplate());
        log('Fallback footer injected', 'warn');
        return true;
      } catch (fallbackError) {
        log('Fallback failed: ' + fallbackError.message, 'error');
        return false;
      }
    }
  }

  // ==========================================
  // 初期化処理
  // ==========================================
  function initializeFooter(footer) {
    if (!footer) {
      log('Footer not found', 'error');
      return;
    }

    try {
      // GitHubリンク設定
      setupGitHubLink(footer);

      // メールリンク設定
      setupMailLinks(footer);

      if (CONFIG.enableSmoothScroll) {
        setupSmoothScroll(footer);
      }

      if (CONFIG.enableAnimation) {
        setupAnimations(footer);
      } else {
        footer.classList.add('footer--visible');
      }

      setupExternalLinks(footer);

      log('All features initialized', 'info');
    } catch (error) {
      log('Initialization error: ' + error.message, 'error');
      footer.classList.add('footer--visible');
    }
  }

  // ==========================================
  // GitHubリンク設定
  // ==========================================
  function setupGitHubLink(footer) {
    var githubLink = footer.querySelector('.js-github');
    if (!githubLink) {
      log('GitHub link not found', 'warn');
      return;
    }

    try {
      var githubUrl = tripleDecodeSecure(CONFIG.githubEncoded, 'url');

      if (!githubUrl) {
        log('GitHub URL decode failed', 'error');
        githubLink.style.display = 'none';
        return;
      }

      log('GitHub URL decoded: ' + githubUrl, 'info');

      // 初回クリック時に href をセットする方式。
      githubLink.addEventListener('click', function () {
        log('GitHub link clicked', 'info');
        githubLink.href = githubUrl;
        log('GitHub link accessed successfully', 'info');
      });

      log('GitHub link configured', 'info');
    } catch (error) {
      log('GitHub link setup failed: ' + error.message, 'error');
      githubLink.style.display = 'none';
    }
  }

  // ==========================================
  // メールリンク設定
  // ==========================================
  function setupMailLinks(footer) {
    var contactLink = footer.querySelector('.js-contact');
    var mailLink = footer.querySelector('.js-mail');

    [contactLink, mailLink].forEach(function (link) {
      if (!link) return;

      try {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          log('Mail link clicked', 'info');

          // メールアドレス構築
          var email = EmailParts.construct();

          if (!email) {
            log('Email construction failed', 'error');
            global.alert('メールアドレスの取得に失敗しました。');
            return;
          }

          try {
            global.location.href = 'mailto:' + email;
            log('Mail link accessed successfully', 'info');
          } catch (mailError) {
            log('Mail navigation failed: ' + mailError.message, 'error');

            var shouldCopy = global.confirm(
              'お問い合わせメール:\n' +
                email +
                '\n\nクリップボードにコピーしますか?'
            );

            if (shouldCopy && global.navigator.clipboard) {
              global.navigator.clipboard
                .writeText(email)
                .then(function () {
                  global.alert('メールアドレスをコピーしました');
                })
                .catch(function () {
                  global.alert('メールアドレス: ' + email);
                });
            } else {
              global.alert('メールアドレス: ' + email);
            }
          }
        });

        log('Mail link configured', 'info');
      } catch (error) {
        log('Mail link setup failed: ' + error.message, 'error');
      }
    });
  }

  // ==========================================
  // スムーススクロール
  // ==========================================
  function setupSmoothScroll(footer) {
    try {
      var anchors = footer.querySelectorAll('a[href^="#"]');
      if (!anchors || !anchors.length) {
        log('No hash links found', 'info');
        return;
      }

      Array.prototype.forEach.call(anchors, function (anchor) {
        anchor.addEventListener('click', function (e) {
          var href = anchor.getAttribute('href');
          if (!href || href === '#') return;

          var target = document.querySelector(href);
          if (!target) return;

          e.preventDefault();

          try {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
            if (global.history && global.history.pushState) {
              global.history.pushState(null, '', href);
            }
            log('Smooth scrolled to ' + href);
          } catch (err) {
            log('Smooth scroll failed: ' + err.message, 'error');
          }
        });
      });

      log('Smooth scroll enabled');
    } catch (error) {
      log('Smooth scroll setup failed: ' + error.message, 'error');
    }
  }

  // ==========================================
  // 外部リンク安全設定
  // ==========================================
  function setupExternalLinks(footer) {
    try {
      var links = footer.querySelectorAll('a[target="_blank"]');
      Array.prototype.forEach.call(links, function (link) {
        var rel = link.getAttribute('rel') || '';
        if (rel.indexOf('noopener') === -1) rel += ' noopener';
        if (rel.indexOf('noreferrer') === -1) rel += ' noreferrer';
        link.setAttribute('rel', rel.trim());
      });

      log('External links secured');
    } catch (error) {
      log('External link setup failed: ' + error.message, 'error');
    }
  }

  // ==========================================
  // アニメーション
  // ==========================================
  function setupAnimations(footer) {
    try {
      var prefersReducedMotion = false;
      try {
        prefersReducedMotion =
          global.matchMedia &&
          global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch (e) {
        // ignore
      }

      if (prefersReducedMotion) {
        log('Animations disabled (user preference)');
        footer.classList.add('footer--visible');
        return;
      }

      global.requestAnimationFrame(function () {
        global.setTimeout(function () {
          footer.classList.add('footer--visible');
          log('Footer animation triggered');
        }, 100);
      });
    } catch (error) {
      log('Animation setup failed: ' + error.message, 'error');
      footer.classList.add('footer--visible');
    }
  }

  // ==========================================
  // 実行
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      var success = injectFooter();
      if (!success) {
        log('Footer initialization failed completely', 'error');
      }
    });
  } else {
    var success = injectFooter();
    if (!success) {
      log('Footer initialization failed completely', 'error');
    }
  }

  // debug 用にランタイム設定を覗けるようにしておく
  if (CONFIG.debug) {
    global.FOOTER_RUNTIME_CONFIG = CONFIG;
  }
})(window);
