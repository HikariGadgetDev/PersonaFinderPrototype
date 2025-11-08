// ==========================================
// footer.js - BEM対応版(修正)
// ==========================================

(function() {
  'use strict';

  // ==========================================
  // 設定
  // ==========================================
  const CONFIG = Object.freeze({
    currentYear: new Date().getFullYear(),
    githubEncoded: 'aHR0cHM6Ly9naXRodWIuY29tL0hpa2FyaUdhZGdldERldi9QZXJzb25hLUZpbmRlci1Qcm90b3R5cGU=',
    mailEncoded: 'aGt1cm9rYXdhZGV2QGdtYWlsLmNvbQ==',
    enableAnimation: true,
    enableSmoothScroll: true,
    debug: true
  });

  // ==========================================
  // ユーティリティ関数
  // ==========================================
  
  // デバッグログ
  function log(message, level = 'info') {
    if (!CONFIG.debug) return;
    const prefix = '[Footer]';
    console[level](`${prefix} ${message}`);
  }

  // Base64デコード(検証付き)
  function decodeBase64Safe(str, type = 'url') {
    try {
      const decoded = decodeURIComponent(escape(atob(str)));
      
      if (type === 'url') {
        new URL(decoded);
      } else if (type === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decoded)) {
          throw new Error('Invalid email format');
        }
      }
      
      log(`Decoded ${type} successfully`);
      return decoded;
      
    } catch (e) {
      log(`Decode failed for ${type}: ${e.message}`, 'error');
      return null;
    }
  }

  const githubUrl = decodeBase64Safe(CONFIG.githubEncoded, 'url');
  const contactEmail = decodeBase64Safe(CONFIG.mailEncoded, 'email');

  // ==========================================
  // フッターHTMLテンプレート
  // ==========================================
  function getFooterTemplate() {
    return `
    <footer class="footer" role="contentinfo">
      <div class="footer__container">
        
        <div class="footer__top">
          <div class="footer__brand">
            <a href="index.html" class="footer__logo" aria-label="Persona Finderホームに戻る">
              <div class="footer__logo-icon">Ψ</div>
              <span class="footer__logo-text">Persona Finder</span>
            </a>
            <p class="footer__tagline">透明な理論の中で、あなた自身を見出す</p>
          </div>

          <nav class="footer__nav" aria-label="フッターナビゲーション">
            <div class="footer__nav-column">
              <h4 class="footer__nav-title">診断ツール</h4>
              <ul class="footer__nav-list">
                <li><a href="finder.html" class="footer__nav-link">簡易診断(未実装)</a></li>
                <li><a href="finder.html" class="footer__nav-link">通常診断</a></li>
                <li><a href="finder.html" class="footer__nav-link">詳細診断(未実装)</a></li>

              </ul>
            </div>

            <div class="footer__nav-column">
              <h4 class="footer__nav-title">理論について</h4>
              <ul class="footer__nav-list">
                <li><a href="function.html" class="footer__nav-link">8つの機能</a></li>
                <li><a href="index.html#types" class="footer__nav-link">16のタイプ(未実装)</a></li>
              </ul>
            </div>

            <div class="footer__nav-column">
              <h4 class="footer__nav-title">リソース</h4>
              <ul class="footer__nav-list">
                <li><a href="#" class="footer__nav-link footer__nav-link--external js-github" target="_blank" rel="noopener noreferrer" aria-label="GitHubリポジトリを開く(新しいタブ)">GitHub<span class="footer__nav-icon" aria-hidden="true">↗</span></a></li>
                <li><a href="#" class="footer__nav-link js-contact" aria-label="お問い合わせメールを送る">お問い合わせ</a></li>
                <li><a href="privacy.html" class="footer__nav-link" aria-label="プライバシーポリシーを読む">プライバシー</a></li>
              </ul>
            </div>
          </nav>
        </div>

        <div class="footer__divider" aria-hidden="true"></div>

        <div class="footer__bottom">
          <div class="footer__quote">
            <blockquote class="footer__quote-text">
              <p>"真理への道は、正しい理論を盲信することではなく、誤った理論を誠実に検証し、より良いものへと進むことにある。"</p>
            </blockquote>
          </div>

          <div class="footer__meta">
            <p class="footer__disclaimer">
              本診断ツールはMBTI理論およびユング心理学を参考に独自開発したものであり、<br class="hide-mobile">
              Mentuzzle・16Personalities・The Myers-Briggs Company等の公式サービスとは一切関係ありません。
            </p>
            <p class="footer__copyright">
              © <time datetime="${CONFIG.currentYear}" class="footer__copyright-year">${CONFIG.currentYear}</time> Persona Finder ·
              Licensed for academic and educational use (CC BY-NC-SA 4.0).<br>
              For commercial licensing or redistribution inquiries, please <a href="#" class="footer__copyright-link js-mail">click here</a>.
            </p>
          </div>
        </div>

        <div class="footer__glow" aria-hidden="true"></div>
      </div>
    </footer>
    `;
  }

  // ==========================================
  // フォールバックHTML
  // ==========================================
  function getFallbackTemplate() {
    return `
    <footer class="footer footer--fallback" role="contentinfo">
      <div class="footer__container">
        <div class="footer__meta">
          <p class="footer__copyright">
            © ${CONFIG.currentYear} Persona Finder
          </p>
        </div>
      </div>
    </footer>
    `;
  }

  // ==========================================
  // 挿入処理
  // ==========================================
  function injectFooter() {
    log('Injection started');

    try {
      const existingFooter = document.querySelector('.footer:not(.footer--noscript)');
      if (existingFooter) {
        existingFooter.remove();
        log('Existing footer removed');
      }

      document.body.insertAdjacentHTML('beforeend', getFooterTemplate());
      log('Footer HTML injected');

      const footer = document.querySelector('.footer');
      if (!footer) {
        throw new Error('Footer injection failed');
      }

      initializeFooter();
      log('Footer initialized successfully');
      
      return true;

    } catch (error) {
      log(`Injection failed: ${error.message}`, 'error');
      
      try {
        const noscriptFooter = document.querySelector('.footer--noscript');
        if (noscriptFooter) {
          noscriptFooter.style.display = 'block';
          log('Noscript footer displayed', 'warn');
          return true;
        }
        
        document.body.insertAdjacentHTML('beforeend', getFallbackTemplate());
        log('Fallback footer injected', 'warn');
        return true;
        
      } catch (fallbackError) {
        log(`Fallback failed: ${fallbackError.message}`, 'error');
        return false;
      }
    }
  }

  // ==========================================
  // 初期化処理
  // ==========================================
  function initializeFooter() {
    const footer = document.querySelector('.footer');
    
    if (!footer) {
      log('Footer not found', 'error');
      return;
    }

    try {
      setupGitHubLink(footer);
      setupMailLinks(footer);
      
      if (CONFIG.enableSmoothScroll) {
        setupSmoothScroll(footer);
      }
      
      if (CONFIG.enableAnimation) {
        setupAnimations(footer);
      }
      
      setupExternalLinks(footer);
      
      log('All features initialized');
      
    } catch (error) {
      log(`Initialization error: ${error.message}`, 'error');
    }
  }

  // ==========================================
  // GitHubリンク設定
  // ==========================================
  function setupGitHubLink(footer) {
    const githubLink = footer.querySelector('.js-github');
    
    if (!githubLink) {
      log('GitHub link not found', 'warn');
      return;
    }
    
    if (!githubUrl) {
      log('GitHub URL not configured', 'error');
      githubLink.style.display = 'none';
      return;
    }
    
    try {
      githubLink.href = githubUrl;
      log('GitHub link configured');
    } catch (error) {
      log(`GitHub link setup failed: ${error.message}`, 'error');
      githubLink.style.display = 'none';
    }
  }

  // ==========================================
  // メールリンク設定
  // ==========================================
  function setupMailLinks(footer) {
    if (!contactEmail) {
      log('Email not configured', 'error');
      
      const contactLink = footer.querySelector('.js-contact');
      const mailLink = footer.querySelector('.js-mail');
      [contactLink, mailLink].forEach(link => {
        if (link) link.style.display = 'none';
      });
      
      return;
    }
    
    const mailtoUrl = `mailto:${contactEmail}`;
    const contactLink = footer.querySelector('.js-contact');
    const mailLink = footer.querySelector('.js-mail');

    [contactLink, mailLink].forEach(link => {
      if (!link) return;
      
      try {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          
          try {
            window.location.href = mailtoUrl;
            log('Mail link clicked');
          } catch (mailError) {
            log(`Mail navigation failed: ${mailError.message}`, 'error');
            
            const shouldCopy = confirm(
              `お問い合わせメール:\n${contactEmail}\n\nクリップボードにコピーしますか?`
            );
            
            if (shouldCopy && navigator.clipboard) {
              navigator.clipboard.writeText(contactEmail)
                .then(() => alert('メールアドレスをコピーしました'))
                .catch(() => alert(`メールアドレス: ${contactEmail}`));
            }
          }
        });
      } catch (error) {
        log(`Mail link event setup failed: ${error.message}`, 'error');
      }
    });
    
    log('Mail links configured');
  }

  // ==========================================
  // スムーススクロール
  // ==========================================
  function setupSmoothScroll(footer) {
    try {
      footer.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
          const href = anchor.getAttribute('href');
          if (!href || href === '#') return;
          
          e.preventDefault();
          
          const target = document.querySelector(href);
          if (target) {
            target.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'start' 
            });
            
            if (history.pushState) {
              history.pushState(null, null, href);
            }
            
            log(`Smooth scrolled to ${href}`);
          }
        });
      });
      
      log('Smooth scroll enabled');
      
    } catch (error) {
      log(`Smooth scroll setup failed: ${error.message}`, 'error');
    }
  }

  // ==========================================
  // 外部リンク安全設定
  // ==========================================
  function setupExternalLinks(footer) {
    try {
      footer.querySelectorAll('a[target="_blank"]').forEach(link => {
        let rel = link.getAttribute('rel') || '';
        
        if (!rel.includes('noopener')) rel += ' noopener';
        if (!rel.includes('noreferrer')) rel += ' noreferrer';
        
        link.setAttribute('rel', rel.trim());
      });
      
      log('External links secured');
      
    } catch (error) {
      log(`External link setup failed: ${error.message}`, 'error');
    }
  }

  // ==========================================
  // アニメーション
  // ==========================================
  function setupAnimations(footer) {
    try {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      
      if (prefersReducedMotion) {
        log('Animations disabled (user preference)');
        footer.classList.add('footer--visible');
        return;
      }
      
      requestAnimationFrame(() => {
        setTimeout(() => {
          footer.classList.add('footer--visible');
          log('Footer animation triggered');
        }, 100);
      });
      
    } catch (error) {
      log(`Animation setup failed: ${error.message}`, 'error');
      footer.classList.add('footer--visible');
    }
  }

  // ==========================================
  // 実行
  // ==========================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const success = injectFooter();
      if (!success) {
        log('Footer initialization failed', 'error');
      }
    });
  } else {
    const success = injectFooter();
    if (!success) {
      log('Footer initialization failed', 'error');
    }
  }

})();