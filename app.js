const STORAGE_KEYS = {
  MENU: "DANTRI_MENU_DATA",
  POSTS: "DANTRI_POSTS_DATA",
  VERSION: "DANTRI_DATA_VERSION"
};
const CURRENT_DATA_VERSION = "2.0-real-crawl";

let menuData = [];
let postsData = [];
let currentCategoryId = "latest";
let currentSubCategoryTitle = null;

// 1. Khởi tạo dữ liệu trong LocalStorage
function initStorage() {
  const savedVersion = localStorage.getItem(STORAGE_KEYS.VERSION);
  const isOutdated = savedVersion !== CURRENT_DATA_VERSION;

  const savedMenu = localStorage.getItem(STORAGE_KEYS.MENU);
  if (!savedMenu || isOutdated) {
    localStorage.setItem(STORAGE_KEYS.MENU, JSON.stringify(INITIAL_MENU_DATA));
    menuData = INITIAL_MENU_DATA.menu;
  } else {
    menuData = JSON.parse(savedMenu).menu;
  }

  const savedPosts = localStorage.getItem(STORAGE_KEYS.POSTS);
  if (!savedPosts || isOutdated) {
    const initialPosts = generateInitialPosts();
    localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(initialPosts));
    postsData = initialPosts;
  } else {
    postsData = JSON.parse(savedPosts);
  }

  if (isOutdated) {
    localStorage.setItem(STORAGE_KEYS.VERSION, CURRENT_DATA_VERSION);
  }
}

// 2. Render ngày tháng hiện tại
function renderCurrentDate() {
  const dateEl = document.getElementById("currentDate");
  const now = new Date();
  dateEl.textContent = now.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}

// 3. Render thanh điều hướng (Navbar) & Chuyên mục dưới Footer
function renderNavbarAndFooter() {
  const navMenu = document.getElementById("navMenu");
  const footerCategories = document.getElementById("footerCategories");

  navMenu.innerHTML = "";
  footerCategories.innerHTML = "";

  menuData.forEach((item) => {
    const li = document.createElement("li");
    li.className = "nav-item";

    const a = document.createElement("a");
    a.href = "#";
    a.className = `nav-link ${item.id === currentCategoryId ? "active" : ""}`;
    a.dataset.id = item.id;
    a.innerHTML = item.id === "home" ? '<i class="fa-solid fa-house"></i>' : item.title;

    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (item.type === "external") {
        window.open(item.url, "_blank");
        return;
      }
      selectCategory(item.id);
    });

    li.appendChild(a);

    // Nếu có menu con (children) thì tạo dropdown
    if (item.children && item.children.length > 0) {
      const dropdown = document.createElement("ul");
      dropdown.className = "dropdown-menu";

      item.children.forEach((child) => {
        const childLi = document.createElement("li");
        const childA = document.createElement("a");
        childA.href = "#";
        childA.textContent = child.title;
        childA.addEventListener("click", (e) => {
          e.preventDefault();
          selectCategory(item.id, child.title);
        });
        childLi.appendChild(childA);
        dropdown.appendChild(childLi);
      });

      li.appendChild(dropdown);
    }

    navMenu.appendChild(li);

    // Thêm vào Footer nếu là category
    if (item.type === "category") {
      const fLi = document.createElement("li");
      const fA = document.createElement("a");
      fA.href = "#";
      fA.textContent = item.title;
      fA.addEventListener("click", (e) => {
        e.preventDefault();
        selectCategory(item.id);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      fLi.appendChild(fA);
      footerCategories.appendChild(fLi);
    }
  });
}

// 4. Chọn chuyên mục và lọc danh sách bài viết
function selectCategory(categoryId, subCategoryTitle = null) {
  currentCategoryId = categoryId;
  currentSubCategoryTitle = subCategoryTitle;
  switchView("listView");

  // Cập nhật trạng thái active trên Navbar
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.id === categoryId);
  });

  const catObj = menuData.find((c) => c.id === categoryId);
  const titleEl = document.getElementById("currentCategoryTitle");
  const subListEl = document.getElementById("subCategoryList");
  const catHeader = document.getElementById("categoryHeader");
  catHeader.style.display = "block";

  if (!catObj || categoryId === "home" || categoryId === "latest") {
    titleEl.textContent = categoryId === "home" ? "Trang chủ - Tin nổi bật" : "Tin mới nhất";
    subListEl.innerHTML = "";
  } else {
    titleEl.textContent = subCategoryTitle ? `${catObj.title} / ${subCategoryTitle}` : catObj.title;
    subListEl.innerHTML = "";
    if (catObj.children) {
      catObj.children.forEach((sub) => {
        const subA = document.createElement("a");
        subA.href = "#";
        subA.textContent = sub.title;
        if (sub.title === subCategoryTitle) subA.classList.add("active");
        subA.addEventListener("click", (e) => {
          e.preventDefault();
          selectCategory(categoryId, sub.title);
        });
        subListEl.appendChild(subA);
      });
    }
  }

  // Lọc bài viết theo chuyên mục (và chuyên mục con nếu có chọn) rồi sắp xếp thời gian giảm dần (Mới -> Cũ)
  let filtered = [...postsData];
  if (categoryId !== "home" && categoryId !== "latest" && catObj) {
    filtered = filtered.filter((post) => {
      const catNames = Array.isArray(post.category) ? post.category : [post.category];
      const matchMainCat =
        post.categoryId === categoryId ||
        catNames.some((c) => c && c.toLowerCase() === catObj.title.toLowerCase());

      if (!matchMainCat) return false;

      if (subCategoryTitle) {
        return (
          post.subCategoryTitle === subCategoryTitle ||
          catNames.some((c) => c && c.toLowerCase() === subCategoryTitle.toLowerCase())
        );
      }
      return true;
    });
  }

  filtered.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  renderPostList(filtered);
}

// 5. Render danh sách bài viết (Top 3 bài 1-2 + Danh sách dọc)
function renderPostList(posts) {
  const topSection = document.getElementById("topSection");
  const remainingList = document.getElementById("remainingList");

  topSection.innerHTML = "";
  remainingList.innerHTML = "";

  if (posts.length === 0) {
    topSection.innerHTML = "<p>Chưa có bài viết nào trong chuyên mục này.</p>";
    return;
  }

  // Lấy 3 bài mới nhất cho Top Section
  const featured = posts[0];
  const sidePosts = posts.slice(1, 3);
  const restPosts = posts.slice(3);

  // Bài lớn bên trái
  const featuredDiv = document.createElement("div");
  featuredDiv.className = "featured-post";
  featuredDiv.innerHTML = `
    <div class="thumb-wrap">
      <img src="${featured.image}" alt="${featured.title}" />
    </div>
    <h2>${featured.title}</h2>
    <p>${featured.excerpt}</p>
  `;
  featuredDiv.addEventListener("click", () => openArticleDetail(featured.id));
  topSection.appendChild(featuredDiv);

  // 2 bài nhỏ bên phải
  const sideDiv = document.createElement("div");
  sideDiv.className = "top-side-posts";
  sidePosts.forEach((post) => {
    const item = document.createElement("div");
    item.className = "side-post-item";
    item.innerHTML = `
      <div class="thumb-wrap">
        <img src="${post.image}" alt="${post.title}" />
      </div>
      <h3>${post.title}</h3>
    `;
    item.addEventListener("click", () => openArticleDetail(post.id));
    sideDiv.appendChild(item);
  });
  topSection.appendChild(sideDiv);

  // Danh sách các bài còn lại xếp dọc
  restPosts.forEach((post) => {
    const authorName = typeof post.author === "object" ? post.author.name : post.author;
    const catName = Array.isArray(post.category) ? post.category.join(", ") : post.category;

    const item = document.createElement("div");
    item.className = "list-post-item";
    item.innerHTML = `
      <div class="thumb-wrap">
        <img src="${post.image}" alt="${post.title}" />
      </div>
      <div class="list-post-info">
        <h3>${post.title}</h3>
        <p>${post.excerpt}</p>
        <div class="post-meta">
          <span><i class="fa-regular fa-folder"></i> ${catName}</span>
          <span><i class="fa-regular fa-clock"></i> ${post.publishedAt}</span>
          <span><i class="fa-regular fa-user"></i> ${authorName}</span>
        </div>
      </div>
    `;
    item.addEventListener("click", () => openArticleDetail(post.id));
    remainingList.appendChild(item);
  });
}

// 6. Hiển thị trang chi tiết bài viết
function openArticleDetail(postId) {
  const post = postsData.find((p) => p.id === postId);
  if (!post) return;

  document.getElementById("categoryHeader").style.display = "none";
  switchView("detailView");

  const authorName = typeof post.author === "object" ? post.author.name : post.author;
  const catName = Array.isArray(post.category) ? post.category.join(", ") : post.category;
  const paragraphs = post.content
    .split("\n")
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join("");

  const detailEl = document.getElementById("articleDetail");
  detailEl.innerHTML = `
    <span class="detail-cat">${catName}</span>
    <h1>${post.title}</h1>
    <div class="detail-meta">
      <span><i class="fa-solid fa-user-pen"></i> Tác giả: <strong>${authorName}</strong></span>
      <span><i class="fa-regular fa-clock"></i> Thời gian đăng: ${post.publishedAt}</span>
      <span><i class="fa-solid fa-globe"></i> Nguồn: <a href="${post.url}" target="_blank">${post.source}</a></span>
    </div>
    <p class="detail-excerpt">${post.excerpt}</p>
    ${post.image ? `<img class="detail-img" src="${post.image}" alt="${post.title}" />` : ""}
    <div class="detail-content">
      ${paragraphs}
    </div>
  `;

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// 7. Chuyển đổi qua lại giữa các View
function switchView(viewId) {
  document.querySelectorAll(".view-section").forEach((sec) => {
    sec.classList.toggle("active", sec.id === viewId);
  });
}

// 8. Xử lý sự kiện trang Crawler
function setupCrawlerEvents() {
  const openBtn = document.getElementById("openCrawlerBtn");
  const footerCrawlerLink = document.getElementById("footerCrawlerLink");
  const runBtn = document.getElementById("runCrawlerBtn");
  const urlInput = document.getElementById("crawlUrlInput");
  const statusEl = document.getElementById("crawlerStatus");
  const jsonOutput = document.getElementById("crawlerJsonOutput");

  const goToCrawler = (e) => {
    if (e) e.preventDefault();
    document.getElementById("categoryHeader").style.display = "none";
    switchView("crawlerView");
  };

  openBtn.addEventListener("click", goToCrawler);
  footerCrawlerLink.addEventListener("click", goToCrawler);

  runBtn.addEventListener("click", async () => {
    const url = urlInput.value.trim();
    statusEl.style.color = "#0f6c3f";
    statusEl.textContent = "Đang thu thập và bóc tách dữ liệu từ URL...";

    try {
      const crawledPost = await crawlNewsArticleByUrl(url);

      // Hiển thị JSON chuẩn hóa đúng cấu trúc mục 1 (bỏ trường phụ trợ khi in JSON)
      const displayJson = {
        id: crawledPost.id,
        title: crawledPost.title,
        slug: crawledPost.slug,
        excerpt: crawledPost.excerpt,
        content: crawledPost.content,
        author: crawledPost.author,
        category: crawledPost.category,
        publishedAt: crawledPost.publishedAt,
        source: crawledPost.source,
        url: crawledPost.url
      };
      jsonOutput.textContent = JSON.stringify(displayJson, null, 2);

      // Lưu vào LocalStorage (nếu trùng ID thì cập nhật, chưa có thì thêm vào đầu danh sách)
      const existingIdx = postsData.findIndex((p) => p.id === crawledPost.id);
      if (existingIdx !== -1) {
        postsData[existingIdx] = crawledPost;
      } else {
        postsData.unshift(crawledPost);
      }

      localStorage.setItem(STORAGE_KEYS.POSTS, JSON.stringify(postsData));
      statusEl.textContent = "Đã crawl thành công và lưu bài viết vào LocalStorage!";
    } catch (error) {
      statusEl.style.color = "#d93025";
      statusEl.textContent = `Lỗi: ${error.message}`;
    }
  });
}

// Khởi chạy ứng dụng
document.addEventListener("DOMContentLoaded", () => {
  initStorage();
  renderCurrentDate();
  renderNavbarAndFooter();
  selectCategory("latest");
  setupCrawlerEvents();

  document.getElementById("backToListBtn").addEventListener("click", () => {
    selectCategory(currentCategoryId, currentSubCategoryTitle);
  });

  document.getElementById("logoLink").addEventListener("click", (e) => {
    e.preventDefault();
    selectCategory("home");
  });

  document.querySelectorAll('[data-nav]').forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      selectCategory(link.dataset.nav);
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
});