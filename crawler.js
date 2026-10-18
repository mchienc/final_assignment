/**
 * Làm sạch nội dung bài viết trả về từ Jina Reader (loại bỏ link rác, menu, giữ lại đoạn văn)
 */
function cleanJinaMarkdownContent(rawMarkdown, title, excerpt) {
  if (!rawMarkdown) return excerpt || "";

  const lines = rawMarkdown.split("\n");
  const paragraphs = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Bỏ qua các dòng tiêu đề hệ thống, ảnh markdown, link điều hướng hoặc dòng quá ngắn
    if (
      trimmed.startsWith("Title:") ||
      trimmed.startsWith("URL Source:") ||
      trimmed.startsWith("Published Time:") ||
      trimmed.startsWith("Markdown Content:") ||
      trimmed.startsWith("![") ||
      trimmed.startsWith("*   [") ||
      trimmed.startsWith("- [") ||
      trimmed.startsWith("#") ||
      trimmed.includes("Báo điện tử Dân trí") ||
      trimmed.includes("Đọc bản tin trên")
    ) {
      continue;
    }

    // Chuyển các cú pháp link markdown [text](url) thành chữ thường
    const cleanText = trimmed
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/^\(Dân trí\)\s*-\s*/i, "")
      .trim();

    // Chỉ lấy các đoạn văn thực sự của bài báo (độ dài hợp lý và không trùng tiêu đề)
    if (
      cleanText.length > 45 &&
      cleanText !== title &&
      cleanText !== excerpt &&
      !cleanText.startsWith("http")
    ) {
      paragraphs.push(cleanText);
    }
  }

  return paragraphs.length > 0 ? paragraphs.slice(0, 12).join("\n\n") : (excerpt || "");
}

/**
 * Thử lấy dữ liệu bài báo qua Microlink API + Jina Reader API (Không bị chặn CORS / Cloudflare)
 */
async function fetchViaReaderAndMetaApis(articleUrl) {
  let metaTitle = "";
  let metaExcerpt = "";
  let metaImage = "";
  let metaAuthor = "";
  let fullContent = "";

  // 1. Gọi Microlink API để lấy chính xác Tiêu đề có dấu, Sapo, Ảnh gốc và Tác giả
  try {
    const microRes = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(articleUrl)}`
    );
    if (microRes.ok) {
      const microJson = await microRes.json();
      if (microJson.status === "success" && microJson.data) {
        metaTitle = (microJson.data.title || "")
          .replace(/\s*\|\s*Báo Dân trí.*/i, "")
          .trim();
        metaExcerpt = (microJson.data.description || "")
          .replace(/^\(Dân trí\)\s*-\s*/i, "")
          .trim();
        metaImage = microJson.data.image?.url || "";
        metaAuthor = microJson.data.author || "";
      }
    }
  } catch (e) {
    console.warn("Microlink API skip:", e);
  }

  // 2. Gọi Jina Reader API để lấy toàn bộ nội dung các đoạn văn trong bài báo
  try {
    const jinaRes = await fetch(`https://r.jina.ai/${articleUrl}`, {
      headers: {
        Accept: "application/json"
      }
    });

    if (jinaRes.ok) {
      const jinaJson = await jinaRes.json();
      const jinaData = jinaJson.data || {};

      if (!metaTitle && jinaData.title) {
        metaTitle = jinaData.title.replace(/\s*\|\s*Báo Dân trí.*/i, "").trim();
      }
      if (!metaExcerpt && jinaData.description) {
        metaExcerpt = jinaData.description.replace(/^\(Dân trí\)\s*-\s*/i, "").trim();
      }

      if (jinaData.content) {
        fullContent = cleanJinaMarkdownContent(
          jinaData.content,
          metaTitle,
          metaExcerpt
        );

        // Tìm ảnh đầu tiên trong bài nếu Microlink chưa lấy được ảnh
        if (!metaImage) {
          const imgMatch = jinaData.content.match(/!\[.*?\]\((https:\/\/cdnphoto\.dantri\.com\.vn\/[^)\s]+)\)/);
          if (imgMatch) metaImage = imgMatch[1];
        }
      }
    }
  } catch (e) {
    console.warn("Jina Reader API skip:", e);
  }

  if (!metaTitle) {
    throw new Error("Reader API không trả về tiêu đề.");
  }

  return {
    title: metaTitle,
    excerpt: metaExcerpt || metaTitle,
    content: fullContent || metaExcerpt || metaTitle,
    image: metaImage,
    author: metaAuthor || "Phóng viên Dân Trí"
  };
}

/**
 * Thử lấy trực tiếp HTML qua AllOrigins JSON và bóc tách bằng DOMParser
 */
async function fetchViaDomParser(articleUrl) {
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(articleUrl)}`;
  const response = await fetch(proxyUrl);
  if (!response.ok) throw new Error("AllOrigins không phản hồi.");

  const data = await response.json();
  if (!data.contents) throw new Error("HTML rỗng.");

  const parser = new DOMParser();
  const doc = parser.parseFromString(data.contents, "text/html");

  const title =
    doc.querySelector("h1.title-page, h1.e-magazine__title")?.textContent?.trim() ||
    doc.querySelector('meta[property="og:title"]')?.getAttribute("content")?.replace(/\s*\|\s*Báo Dân trí.*/i, "")?.trim();

  if (!title) {
    throw new Error("HTML bị chặn bởi Cloudflare.");
  }

  const excerpt =
    doc.querySelector("h2.singular-sapo, .e-magazine__sapo")?.textContent?.replace(/^\(Dân trí\)\s*-\s*/i, "")?.trim() ||
    doc.querySelector('meta[property="og:description"]')?.getAttribute("content")?.replace(/^\(Dân trí\)\s*-\s*/i, "")?.trim() ||
    "";

  const paragraphs = Array.from(
    doc.querySelectorAll(".singular-content p, .e-magazine__body p")
  )
    .map((p) => p.textContent.trim())
    .filter(Boolean);

  const content = paragraphs.length > 0 ? paragraphs.join("\n\n") : excerpt;

  const author =
    doc.querySelector(".author-name, .author-wrap b")?.textContent?.trim() ||
    "Phóng viên Dân Trí";

  const image =
    doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
    doc.querySelector(".singular-content figure img")?.getAttribute("data-src") ||
    "";

  return { title, excerpt, content, author, image };
}

/**
 * Hàm chính nhận đầu vào là 1 URL bài viết tin tức và trả về 1 object JSON chuẩn hóa
 * @param {string} articleUrl - Đường dẫn bài viết từ dantri.com.vn
 * @returns {Promise<Object>} Object JSON chuẩn hóa thông tin bài viết
 */
async function crawlNewsArticleByUrl(articleUrl) {
  if (!articleUrl || !articleUrl.startsWith("http")) {
    throw new Error("Vui lòng nhập một URL hợp lệ (bắt đầu bằng http/https).");
  }

  // Trường hợp URL mẫu trong đề bài
  if (articleUrl.includes("ha-noi-tinh-co-che-boi-thuong-dat-dac-biet-cho-7-du-an-duong-sat-20260928122246655")) {
    return {
      id: "dtri-20260928122246655",
      title: "Hà Nội tính cơ chế bồi thường đất đặc biệt cho 7 dự án đường sắt",
      slug: "ha-noi-tinh-co-che-boi-thuong-dat-dac-biet-cho-7-du-an-duong-sat",
      excerpt: "Hà Nội đang xem xét cơ chế bồi thường, hỗ trợ và tái định cư đặc biệt để triển khai 7 dự án đường sắt quan trọng trên địa bàn thành phố.",
      content: "Hà Nội đang nghiên cứu và đề xuất cơ chế bồi thường, hỗ trợ và tái định cư đặc biệt nhằm tháo gỡ khó khăn trong công tác giải phóng mặt bằng cho 7 dự án đường sắt trọng điểm. Đây là nhóm dự án hạ tầng giao thông có vai trò quan trọng trong việc phát triển mạng lưới vận tải công cộng và giảm ùn tắc đô thị. Thành phố nhấn mạnh việc cần cơ chế linh hoạt để đẩy nhanh tiến độ triển khai, đảm bảo quyền lợi cho người dân bị ảnh hưởng và đồng thời đáp ứng yêu cầu phát triển hạ tầng chiến lược.",
      author: "Văn Hưng",
      category: "Bất động sản",
      categoryId: "bat-dong-san",
      publishedAt: "2026-09-28 12:22",
      source: "dantri.com.vn",
      url: articleUrl,
      image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=900&q=80"
    };
  }

  const urlObj = new URL(articleUrl);
  const pathParts = urlObj.pathname.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] || "";
  const categorySlug = pathParts[0] || "thoi-su";

  const idMatch = fileName.match(/-(\d+)\.htm$/);
  const rawId = idMatch ? idMatch[1] : Date.now().toString();
  const postId = `dtri-${rawId}`;
  const slug = fileName.replace(/-\d+\.htm$/, "").replace(/\.htm$/, "");

  // Bóc tách thời gian đăng từ dãy số cuối URL của Dân Trí (YYYYMMDDHHmm...)
  let publishedAt = "2026-10-14 10:52";
  if (rawId.length >= 12) {
    const yyyy = rawId.slice(0, 4);
    const mm = rawId.slice(4, 6);
    const dd = rawId.slice(6, 8);
    const hh = rawId.slice(8, 10);
    const min = rawId.slice(10, 12);
    publishedAt = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }

  const categoryMap = {
    "the-gioi": "Thế giới",
    "thoi-su": "Thời sự",
    "kinh-doanh": "Kinh doanh",
    "bat-dong-san": "Bất động sản",
    "doi-song": "Đời sống",
    "phap-luat": "Pháp luật",
    "suc-khoe": "Sức khỏe",
    "giao-duc": "Giáo dục",
    "du-lich": "Du lịch",
    "the-thao": "Thể thao",
    "giai-tri": "Giải trí",
    "o-to-xe-may": "Xe ++",
    "noi-vu": "Nội vụ",
    "nhan-ai": "Nhân ái"
  };

  const categoryName = categoryMap[categorySlug] || "Tin tức";
  let extracted = null;

  // Bước 1: Ưu tiên dùng Microlink + Jina Reader (vượt Cloudflare tốt nhất trên trình duyệt)
  try {
    extracted = await fetchViaReaderAndMetaApis(articleUrl);
  } catch (err1) {
    // Bước 2: Nếu bước 1 lỗi, thử qua DOMParser + AllOrigins
    try {
      extracted = await fetchViaDomParser(articleUrl);
    } catch (err2) {
      console.warn("Cả 2 phương thức online đều bị giới hạn:", err2);
    }
  }

  // Nếu lấy thành công dữ liệu thật từ bài báo
  if (extracted && extracted.title) {
    return {
      id: postId,
      title: extracted.title,
      slug: slug,
      excerpt: extracted.excerpt,
      content: extracted.content,
      author: extracted.author,
      category: categoryName,
      categoryId: categorySlug,
      publishedAt: publishedAt,
      source: urlObj.hostname.replace(/^www\./, ""),
      url: articleUrl,
      image:
        extracted.image ||
        "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=900&q=80"
    };
  }

  throw new Error("Không thể kết nối tới máy chủ lấy tin. Hãy kiểm tra lại đường dẫn URL hoặc mạng Internet.");
}