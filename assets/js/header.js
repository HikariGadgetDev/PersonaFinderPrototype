// assets/js/header.js
document.addEventListener("DOMContentLoaded", () => {
  const header = document.getElementById("header");
  if (!header) return;

  // ページ別の aria-label
  let ariaLabel = "ペルソナファインダー インデックスページ"; 
  const pathname = location.pathname;
  if (pathname.endsWith("function.html")) {
    ariaLabel = "ペルソナファインダー 詳細ページ";
  } else if (pathname.endsWith("personality.html")) {
    ariaLabel = "性格類型詳細ページ";
  }

  header.innerHTML = `
    <div class="header-inner">
      <a href="index.html" class="logo" aria-label="${ariaLabel}">
        <div class="header-logo" aria-hidden="true">Ψ</div>
        <span class="header-title">Persona Finder</span>
      </a>

      <nav class="nav">
        <a href="index.html">Home</a>
        <div class="dropdown">
          <span>認知機能</span>
          <div class="dropdown-menu">
            <a href="function.html?code=ni">Ni（内向的直観）</a>
            <a href="function.html?code=ne">Ne（外向的直観）</a>
            <a href="function.html?code=si">Si（内向的感覚）</a>
            <a href="function.html?code=se">Se（外向的感覚）</a>
            <a href="function.html?code=ti">Ti（内向的思考）</a>
            <a href="function.html?code=te">Te（外向的思考）</a>
            <a href="function.html?code=fi">Fi（内向的感情）</a>
            <a href="function.html?code=fe">Fe（外向的感情）</a>
          </div>
        </div>
        <a href="types.html">タイプ一覧</a>
      </nav>
    </div>
  `;
});
// 認知機能ドロップダウンをクリックで開閉
document.addEventListener("click", (e) => {
  const dropdown = document.querySelector(".dropdown");
  if (!dropdown) return;

  if (dropdown.contains(e.target)) {
    dropdown.classList.toggle("open");
  } else {
    dropdown.classList.remove("open");
  }
});

// スクロール時のヘッダー変化
window.addEventListener("scroll", () => {
  const header = document.querySelector("#header");
  if (!header) return;
  if (window.scrollY > 60) {
    header.classList.add("scrolled");
  } else {
    header.classList.remove("scrolled");
  }
});
