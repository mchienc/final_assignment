/**
 * Script Node.js tự động thu thập (crawl) dữ liệu thực tế từ https://dantri.com.vn/
 * - Thu thập cây phân cấp chuyên mục (menu)
 * - Thu thập ít nhất 10 bài viết cho mỗi chuyên mục & chuyên mục con
 * - Xuất kết quả chuẩn hóa JSON ra file data.js để nạp vào LocalStorage
 *
 * Cách chạy trên Terminal:
 *   node crawl-data.js
 */

const fs = require("fs");
const path = require("path");

// 1. Cấu trúc cây phân cấp chuyên mục từ https://dantri.com.vn/
const MENU_DATA = {
  menu: [
    {
      id: "home",
      title: "Home",
      url: "https://dantri.com.vn/",
      type: "home"
    },
    {
      id: "dt360",
      title: "Dân trí 360",
      url: "https://dantri.com.vn/dt360.htm",
      type: "external"
    },
    {
      id: "latest",
      title: "Mới nhất",
      url: "https://dantri.com.vn/tin-moi-nhat.htm",
      type: "category"
    },
    {
      id: "the-gioi",
      title: "Thế giới",
      url: "https://dantri.com.vn/the-gioi.htm",
      type: "category",
      children: [
        {
          id: "quan-su",
          title: "Quân sự",
          url: "https://dantri.com.vn/the-gioi/quan-su.htm"
        },
        {
          id: "phan-tich",
          title: "Phân tích - Bình luận",
          url: "https://dantri.com.vn/the-gioi/phan-tich-binh-luan.htm"
        },
        {
          id: "the-gioi-do-day",
          title: "Thế giới đó đây",
          url: "https://dantri.com.vn/the-gioi/the-gioi-do-day.htm"
        },
        {
          id: "kieu-bao",
          title: "Kiều bào",
          url: "https://dantri.com.vn/the-gioi/kieu-bao.htm"
        }
      ]
    },
    {
      id: "thoi-su",
      title: "Thời sự",
      url: "https://dantri.com.vn/thoi-su.htm",
      type: "category",
      children: [
        {
          id: "chinh-tri",
          title: "Chính trị",
          url: "https://dantri.com.vn/thoi-su/chinh-tri.htm"
        },
        {
          id: "giao-thong",
          title: "Giao thông",
          url: "https://dantri.com.vn/thoi-su/giao-thong.htm"
        },
        {
          id: "moi-truong",
          title: "Môi trường",
          url: "https://dantri.com.vn/thoi-su/moi-truong.htm"
        },
        {
          id: "nong-tren-mang",
          title: "Nóng trên mạng",
          url: "https://dantri.com.vn/thoi-su/nong-tren-mang.htm"
        }
      ]
    },
    {
      id: "kinh-doanh",
      title: "Kinh doanh",
      url: "https://dantri.com.vn/kinh-doanh.htm",
      type: "category",
      children: [
        {
          id: "tai-chinh",
          title: "Tài chính",
          url: "https://dantri.com.vn/kinh-doanh/tai-chinh.htm"
        },
        {
          id: "doanh-nghiep",
          title: "Doanh nghiệp",
          url: "https://dantri.com.vn/kinh-doanh/doanh-nghiep.htm"
        }
      ]
    },
    {
      id: "bat-dong-san",
      title: "Bất động sản",
      url: "https://dantri.com.vn/bat-dong-san.htm",
      type: "category",
      children: [
        {
          id: "du-an",
          title: "Dự án",
          url: "https://dantri.com.vn/bat-dong-san/du-an.htm"
        },
        {
          id: "thi-truong",
          title: "Thị trường",
          url: "https://dantri.com.vn/bat-dong-san/thi-truong.htm"
        }
      ]
    },
    {
      id: "doi-song",
      title: "Đời sống",
      url: "https://dantri.com.vn/doi-song.htm",
      type: "category"
    }
  ]
};

// Danh sách các chuyên mục cần crawl (mỗi mục lấy ít nhất 10 bài viết)
const TARGETS = [
  { catId: "the-gioi", catTitle: "Thế giới", subId: "quan-su", subTitle: "Quân sự", url: "https://dantri.com.vn/the-gioi/quan-su.htm" },
  { catId: "the-gioi", catTitle: "Thế giới", subId: "phan-tich", subTitle: "Phân tích - Bình luận", url: "https://dantri.com.vn/the-gioi/phan-tich-binh-luan.htm" },
  { catId: "the-gioi", catTitle: "Thế giới", subId: "the-gioi-do-day", subTitle: "Thế giới đó đây", url: "https://dantri.com.vn/the-gioi/the-gioi-do-day.htm" },
  { catId: "the-gioi", catTitle: "Thế giới", subId: "kieu-bao", subTitle: "Kiều bào", url: "https://dantri.com.vn/the-gioi/kieu-bao.htm" },
  { catId: "thoi-su", catTitle: "Thời sự", subId: "chinh-tri", subTitle: "Chính trị", url: "https://dantri.com.vn/thoi-su/chinh-tri.htm" },
  { catId: "thoi-su", catTitle: "Thời sự", subId: "giao-thong", subTitle: "Giao thông", url: "https://dantri.com.vn/thoi-su/giao-thong.htm" },
  { catId: "thoi-su", catTitle: "Thời sự", subId: "moi-truong", subTitle: "Môi trường", url: "https://dantri.com.vn/thoi-su/moi-truong.htm" },
  { catId: "thoi-su", catTitle: "Thời sự", subId: "nong-tren-mang", subTitle: "Nóng trên mạng", url: "https://dantri.com.vn/thoi-su/nong-tren-mang.htm" },
  { catId: "kinh-doanh", catTitle: "Kinh doanh", subId: "tai-chinh", subTitle: "Tài chính", url: "https://dantri.com.vn/kinh-doanh/tai-chinh.htm" },
  { catId: "kinh-doanh", catTitle: "Kinh doanh", subId: "doanh-nghiep", subTitle: "Doanh nghiệp", url: "https://dantri.com.vn/kinh-doanh/doanh-nghiep.htm" },
  { catId: "bat-dong-san", catTitle: "Bất động sản", subId: "du-an", subTitle: "Dự án", url: "https://dantri.com.vn/bat-dong-san/du-an.htm" },
  { catId: "bat-dong-san", catTitle: "Bất động sản", subId: "thi-truong", subTitle: "Thị trường", url: "https://dantri.com.vn/bat-dong-san/thi-truong.htm" },
  { catId: "doi-song", catTitle: "Đời sống", subId: null, subTitle: null, url: "https://dantri.com.vn/doi-song.htm" }
];

function decodeHtmlEntities(str) {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .trim();
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return await res.text();
}

// Bóc tách danh sách link bài viết từ trang chuyên mục Dân Trí
function extractArticleLinksFromCategory(html, limit = 10) {
  const results = [];
  const seenUrls = new Set();
  const articleRegex = /<article[^>]*class="[^"]*article-item[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articleRegex.exec(html)) !== null) {
    const block = match[1];
    const titleMatch =
      block.match(/<h3[^>]*class="[^"]*article-title[^"]*"[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
      block.match(/<a[^>]*data-prop="title"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!titleMatch) continue;

    let href = titleMatch[1].trim();
    if (href.startsWith("/")) href = "https://dantri.com.vn" + href;
    if (!href.startsWith("https://dantri.com.vn/") || !href.endsWith(".htm")) continue;
    if (seenUrls.has(href)) continue;

    const title = decodeHtmlEntities(titleMatch[2].replace(/<[^>]+>/g, "").trim());
    if (!title) continue;

    const imgMatch = block.match(/<img[^>]*data-src="([^"]+)"/i) || block.match(/<img[^>]*src="([^"]+)"/i);
    let image = imgMatch ? imgMatch[1].trim() : "";
    if (image.startsWith("data:image")) {
      const dataSrc = block.match(/data-srcset="([^"\s]+)/i) || block.match(/srcset="([^"\s]+)/i);
      if (dataSrc) image = dataSrc[1];
    }

    const sapoMatch = block.match(/data-prop="sapo"[^>]*>([\s\S]*?)<\/a>/i);
    const excerpt = sapoMatch ? decodeHtmlEntities(sapoMatch[1].replace(/<[^>]+>/g, "").trim()) : "";

    seenUrls.add(href);
    results.push({ url: href, title, image, excerpt });
    if (results.length >= limit) break;
  }
  return results;
}

// Bóc tách chi tiết từng bài viết theo đúng bảng cấu trúc yêu cầu
async function fetchArticleDetail(item, target) {
  const urlObj = new URL(item.url);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] || "";
  const idMatch = fileName.match(/-(\d+)\.htm$/);
  const rawId = idMatch ? idMatch[1] : Date.now().toString();
  const postId = `dtri-${rawId}`;
  const slug = fileName.replace(/-\d+\.htm$/, "").replace(/\.htm$/, "");

  let publishedAt = "2026-10-18 08:00";
  if (rawId.length >= 12) {
    const yyyy = rawId.slice(0, 4);
    const mm = rawId.slice(4, 6);
    const dd = rawId.slice(6, 8);
    const hh = rawId.slice(8, 10);
    const min = rawId.slice(10, 12);
    publishedAt = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  let title = item.title;
  let excerpt = item.excerpt;
  let image = item.image;
  let author = { name: "Phóng viên Dân Trí", role: "Báo điện tử Dân Trí" };
  let content = "";

  try {
    const html = await fetchHtml(item.url);

    // Đọc JSON-LD NewsArticle của Dân Trí để lấy chính xác tác giả, ảnh gốc, sapo, giờ đăng
    const ldMatches = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const m of ldMatches) {
      try {
        const json = JSON.parse(m[1].trim());
        if (json["@type"] === "NewsArticle") {
          if (json.headline) title = decodeHtmlEntities(json.headline);
          if (json.description) {
            excerpt = decodeHtmlEntities(json.description).replace(/^\(Dân trí\)\s*-\s*/i, "").trim();
          }
          if (json.mainEntityOfPage?.primaryImageOfPage?.url) {
            image = json.mainEntityOfPage.primaryImageOfPage.url;
          } else if (Array.isArray(json.image) && json.image[0]) {
            image = json.image[0];
          } else if (json.thumbnailUrl) {
            image = json.thumbnailUrl;
          }
          if (json.author) {
            const authObj = Array.isArray(json.author) ? json.author[0] : json.author;
            if (authObj?.name) {
              author = {
                name: decodeHtmlEntities(authObj.name),
                role: "Phóng viên Dân Trí",
                ...(authObj.url ? { url: authObj.url } : {})
              };
            }
          }
        }
      } catch (_) {}
    }

    // Lấy các đoạn văn <p> trong thân bài báo
    const pMatches = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
      .map((m) => decodeHtmlEntities(m[1].replace(/<[^>]+>/g, "").trim()))
      .filter(
        (t) =>
          t.length > 35 &&
          !t.startsWith("(Ảnh:") &&
          !t.includes("Báo điện tử Dân trí") &&
          !t.includes("Cơ quan của Bộ Nội vụ") &&
          !t.includes("Giấy phép hoạt động")
      );

    if (pMatches.length > 0) {
      content = pMatches.slice(0, 5).join("\n\n");
    }
  } catch (err) {
    console.warn("Bỏ qua chi tiết (dùng sapo):", item.url);
  }

  if (!excerpt) excerpt = title;
  if (!content) content = excerpt;

  const categories = target.subTitle ? [target.catTitle, target.subTitle] : [target.catTitle];

  return {
    id: postId,
    title,
    slug,
    excerpt,
    content,
    author,
    category: categories,
    categoryId: target.catId,
    subCategoryId: target.subId || null,
    subCategoryTitle: target.subTitle || null,
    publishedAt,
    source: "dantri.com.vn",
    url: item.url,
    image
  };
}

async function runBatchCrawler() {
  const allPosts = [];
  const seenIds = new Set();

  for (const target of TARGETS) {
    console.log(`Đang crawl: ${target.catTitle}${target.subTitle ? " / " + target.subTitle : ""} (${target.url})`);
    const catHtml = await fetchHtml(target.url);
    const items = extractArticleLinksFromCategory(catHtml, 10);

    for (const it of items) {
      const post = await fetchArticleDetail(it, target);
      if (seenIds.has(post.id)) {
        post.id = `${post.id}-${target.subId || "sub"}`;
      }
      seenIds.add(post.id);
      allPosts.push(post);
    }
  }

  const outputContent = `// 1. Dữ liệu cây phân cấp chuyên mục từ https://dantri.com.vn/
const INITIAL_MENU_DATA = ${JSON.stringify(MENU_DATA, null, 2)};

// 2. Danh sách bài viết thực tế thu thập từ https://dantri.com.vn/ (đủ 10 bài/chuyên mục & chuyên mục con)
const INITIAL_POSTS_DATA = ${JSON.stringify(allPosts, null, 2)};

function generateInitialPosts() {
  return INITIAL_POSTS_DATA;
}
`;

  const outPath = path.join(__dirname, "data.js");
  fs.writeFileSync(outPath, outputContent, "utf8");
  console.log(`Hoàn tất! Đã lưu ${allPosts.length} bài viết vào ${outPath}`);
}

runBatchCrawler().catch(console.error);
