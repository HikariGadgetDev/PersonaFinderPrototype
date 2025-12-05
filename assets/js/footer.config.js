// ==========================================
// footer.config.js
// Persona Finder 専用フッター設定
//
// 役割:
//  - footer.js が参照するサイト固有の設定を一箇所に集約する
//  - URL やメールアドレス本体はここでも「難読化された形」でのみ保持する
//
// ポイント:
//  - window.FOOTER_CONFIG が存在しなければ、footer.js 側のデフォルトが使われる
//  - debug はあえて指定していない → localhost / ?footerDebug=true で自動ON
// ==========================================

window.FOOTER_CONFIG = Object.freeze({
  // ------------------------------------------
  // GitHub リポジトリ URL（トリプル難読化済み文字列）
  //  - 実 URL は footer.js 内の tripleDecodeSecure() で復号される
  //  - ここでは「平文 URL を一切書かない」ことが目的（スパム/BOT対策の一段）
  // ------------------------------------------
  githubEncoded: 'MKO5qT90o3WDpzIxozyTLJ5ip3WyHP92MHE0MJqxLHqcpzSenHtioJ9wYzW1nUEcMl8iBaAjqUEb',

  // ------------------------------------------
  // メールアドレス分割 Base64 パーツ
  //
  // 逆順でデコードされ、footer.js 側で:
  //   local-part:  p1 (reverse) + p2 (reverse)
  //   domain:      p3 (reverse) + '.' + p4 (reverse)
  //
  // 例:  "hkurakawa" + "dev" + "gmail" + "com"
  //   → "hkurakawadev@gmail.com" のように再構成されるイメージ
  //
  // ※ 実プロジェクトで変えるときは、ここだけ Base64 を差し替えればOK。
  // ------------------------------------------
  emailParts: {
    p1: 'aGt1cm9rYXdh', // "hkurakawa" を reverse して Base64 にしたもの（例）
    p2: 'ZGV2',         // "dev"
    p3: 'Z21haWw=',     // "gmail"
    p4: 'Y29t'          // "com"
  },

  // ------------------------------------------
  // 動き系フラグ
  //  - アニメーションやスムーススクロールを無効化したい場合は false に
  // ------------------------------------------
  enableAnimation: true,
  enableSmoothScroll: true

  // ------------------------------------------
  // debug フラグ（任意）
  //
  // ・ここで debug: true / false を明示すると footer.js 側の自動判定より優先される
  // ・指定しない場合:
  //    - localhost / 127.0.0.1
  //    - URL に ?footerDebug=true
  //   のときだけ debug ログが有効になる。
  //
  // 必要になったらコメントアウトを外して使うイメージで。
  // ------------------------------------------
  // debug: false
});
