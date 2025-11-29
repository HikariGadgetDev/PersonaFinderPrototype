// assets/js/intersection.js
(function () {
  'use strict';

  function initSectionObserver() {
    // 対象は main 内のセクションに限定（ヘッダー等は除外）
    const sections = document.querySelectorAll('main section');
    if (!sections.length) return;

    // 古いブラウザ用フォールバック（念のため）
    if (!('IntersectionObserver' in window)) {
      sections.forEach((sec) => sec.classList.add('section--visible'));
      return;
    }

    const options = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        entry.target.classList.add('section--visible');
        // 一度表示したら監視解除（無駄なコールを減らす）
        obs.unobserve(entry.target);
      });
    }, options);

    sections.forEach((sec) => observer.observe(sec));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSectionObserver);
  } else {
    initSectionObserver();
  }
})();
