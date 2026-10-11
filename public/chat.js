document.addEventListener("DOMContentLoaded", () => {
  const chatForm = document.getElementById("chatForm");
  const chatInput = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const messagesList = document.getElementById("messagesList");
  const welcomeCard = document.getElementById("welcomeCard");
  const typingIndicator = document.getElementById("typingIndicator");
  const toneSelect = document.getElementById("toneSelect");
  const clearChatBtn = document.getElementById("clearChatBtn");
  const chatWindow = document.getElementById("chatWindow");
  const apiKeyBanner = document.getElementById("apiKeyBanner");
  const apiKeyBannerText = document.getElementById("apiKeyBannerText");
  const sessionProfileBar = document.getElementById("sessionProfileBar");
  const sessionProfileText = document.getElementById("sessionProfileText");
  const resetProfileBtn = document.getElementById("resetProfileBtn");

  let sessionId = sessionStorage.getItem("bunda_sehat_session_id");
  if (!sessionId) {
    sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
    sessionStorage.setItem("bunda_sehat_session_id", sessionId);
  }

  let conversationHistory = [];

  async function checkServerStatus() {
    try {
      const res = await fetch("/api/status");
      const data = await res.json();
      if (!data.hasApiKey) {
        apiKeyBanner.classList.remove("hidden");
        apiKeyBannerText.innerHTML = `⚠️ <strong>Peringatan:</strong> <code>GEMINI_API_KEY</code> belum diisi di file <code>.env</code>. Silakan isi API key agar chatbot dapat menjawab.`;
      } else {
        apiKeyBanner.classList.add("hidden");
      }
    } catch (err) {
      console.warn("Gagal menghubungi /api/status:", err);
    }
  }
  checkServerStatus();

  if (resetProfileBtn) {
    resetProfileBtn.addEventListener("click", () => {
      sessionId = "sess_" + Date.now() + "_" + Math.random().toString(36).substring(2, 8);
      sessionStorage.setItem("bunda_sehat_session_id", sessionId);
      sessionProfileBar.classList.add("hidden");
      appendMessage("bot", "ℹ️ *Memori profil anak dan sesi telah direset.*");
    });
  }

  chatInput.addEventListener("input", () => {
    chatInput.style.height = "auto";
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + "px";
  });

  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event("submit"));
    }
  });

  document.querySelectorAll(".prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const query = chip.getAttribute("data-query");
      if (query) {
        chatInput.value = query;
        chatForm.dispatchEvent(new Event("submit"));
      }
    });
  });

  clearChatBtn.addEventListener("click", () => {
    if (confirm("Hapus seluruh riwayat percakapan?")) {
      messagesList.innerHTML = "";
      conversationHistory = [];
      welcomeCard.style.display = "block";
      scrollToBottom();
    }
  });

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const message = chatInput.value.trim();
    if (!message) return;

    if (welcomeCard) {
      welcomeCard.style.display = "none";
    }
    appendMessage("user", message);
    chatInput.value = "";
    chatInput.style.height = "auto";
    chatInput.focus();

    showTyping(true);
    sendBtn.disabled = true;

    try {
      const tone = toneSelect ? toneSelect.value : "santai";
      const response = await fetch("/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message,
          history: conversationHistory,
          tone,
        }),
      });

      const data = await response.json();
      showTyping(false);

      if (!response.ok) {
        const errorText = data.error || "Terjadi kesalahan pada server.";
        appendMessage("bot", `⚠️ **Galat:** ${errorText}`, { isError: true });
        return;
      }

      if (data.sessionProfile) {
        updateProfileBar(data.sessionProfile);
      }

      const botReply = data.reply;
      appendMessage("bot", botReply, {
        isEmergency: data.isEmergency,
        functionData: data.functionData,
      });

      conversationHistory.push({
        role: "user",
        parts: [{ text: message }],
      });
      conversationHistory.push({
        role: "model",
        parts: [{ text: botReply }],
      });

      if (conversationHistory.length > 20) {
        conversationHistory = conversationHistory.slice(-20);
      }
    } catch (err) {
      showTyping(false);
      console.error("Gagal mengirim chat:", err);
      appendMessage(
        "bot",
        "⚠️ **Koneksi terputus:** Tidak dapat terhubung ke server. Pastikan server backend sedang aktif.",
        { isError: true }
      );
    } finally {
      sendBtn.disabled = false;
      scrollToBottom();
    }
  });

  function updateProfileBar(profil) {
    if (!profil) return;
    const parts = [];
    if (profil.namaAnak) parts.push(`Anak: <strong>${escapeHtml(profil.namaAnak)}</strong>`);
    if (profil.tanggalLahirAnak) parts.push(`Lahir: <strong>${escapeHtml(profil.tanggalLahirAnak)}</strong>`);
    if (profil.namaPanggilan) parts.push(`Orang Tua: <strong>${escapeHtml(profil.namaPanggilan)}</strong>`);

    if (parts.length > 0) {
      sessionProfileText.innerHTML = `Memori Sesi: ${parts.join(" • ")}`;
      sessionProfileBar.classList.remove("hidden");
    }
  }

  const savedTone = localStorage.getItem("bunda_sehat_tone");
  if (savedTone && toneSelect) {
    toneSelect.value = savedTone;
  }
  if (toneSelect) {
    toneSelect.addEventListener("change", () => {
      localStorage.setItem("bunda_sehat_tone", toneSelect.value);
    });
  }

  function appendMessage(sender, text, options = {}) {
    const row = document.createElement("div");
    row.className = `message-row ${sender}`;

    if (sender === "bot") {
      const avatar = document.createElement("div");
      avatar.className = "bot-avatar-mini";
      avatar.textContent = options.isEmergency ? "🚨" : "🌸";
      row.appendChild(avatar);
    }

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (options.isError || options.isEmergency) {
      bubble.classList.add("emergency-alert");
    }

    bubble.innerHTML = formatMarkdown(text);

    if (options.functionData && options.functionData.success) {
      if (options.functionData.jadwalLengkap) {
        const widget = renderVaccineWidget(options.functionData);
        bubble.appendChild(widget);
      } else if (options.functionData.tekstur || options.functionData.kategori) {
        const widget = renderMPASIWidget(options.functionData);
        bubble.appendChild(widget);
      }
    }

    row.appendChild(bubble);
    messagesList.appendChild(row);
    scrollToBottom();
  }

  function renderMPASIWidget(data) {
    const card = document.createElement("div");
    card.className = "mpasi-card-widget";

    if (data.kategori && data.kategori.includes("ASI Eksklusif")) {
      card.innerHTML = `
        <div class="mpasi-widget-header">
          <div class="mpasi-widget-title"><span>🤱 ${escapeHtml(data.kategori)}</span></div>
          <div class="mpasi-age-badge">${data.usiaBulan} Bulan</div>
        </div>
        <div class="mpasi-grid-item" style="background:#f0fdfa; border-left:3px solid #0d9488; margin-top:6px;">
          <strong style="color:#0f766e;">Prinsip Utama:</strong> ${escapeHtml(data.pesanKunci)}<br/>
          <small style="color:#475569; display:block; margin-top:4px;">${escapeHtml(data.alasan)}</small>
        </div>
      `;
      return card;
    }

    const menuItems = (data.contohMenu || []).map((m) => `<li>${escapeHtml(m)}</li>`).join("");
    const pantangan = (data.pantanganDanPeringatan || []).slice(0, 2).map((p) => `<li>⚠️ ${escapeHtml(p)}</li>`).join("");

    card.innerHTML = `
      <div class="mpasi-widget-header">
        <div class="mpasi-widget-title"><span>🥣 Panduan MPASI Resmi (Kemenkes &amp; IDAI)</span></div>
        <div class="mpasi-age-badge">${escapeHtml(data.rentangUsia)}</div>
      </div>
      <div class="mpasi-detail-grid">
        <div class="mpasi-grid-item">
          <div class="mpasi-label">Tekstur Makanan:</div>
          <div class="mpasi-val">${escapeHtml(data.tekstur)}</div>
        </div>
        <div class="mpasi-grid-item">
          <div class="mpasi-label">Porsi &amp; Frekuensi:</div>
          <div class="mpasi-val">${escapeHtml(data.porsiPerMakan)} • ${escapeHtml(data.frekuensi)}</div>
        </div>
      </div>
      ${menuItems
        ? `
        <div class="mpasi-section-title">Contoh Menu Bergizi:</div>
        <ul class="mpasi-menu-list">${menuItems}</ul>
      `
        : ""
      }
      ${data.fingerFood
        ? `
        <div class="mpasi-grid-item" style="margin-bottom:8px; background:#f8fafc; border-left:3px solid #64748b;">
          <div class="mpasi-label" style="color:#475569;">Anjuran Finger Food:</div>
          <div class="mpasi-val">${escapeHtml(data.fingerFood)}</div>
        </div>
      `
        : ""
      }
      ${pantangan
        ? `
        <div class="mpasi-warning-box">
          <div class="mpasi-warning-title">Perhatian Khusus:</div>
          <ul class="mpasi-warning-list">${pantangan}</ul>
        </div>
      `
        : ""
      }
    `;
    return card;
  }

  function renderVaccineWidget(data) {
    const card = document.createElement("div");
    card.className = "vaccine-card-widget";

    const header = document.createElement("div");
    header.className = "vaccine-widget-header";
    header.innerHTML = `
      <div class="vaccine-widget-title">
        <span>💉 Kartu Jadwal Imunisasi Resmi</span>
      </div>
      <div class="vaccine-age-badge">Usia: ${escapeHtml(data.usiaAnak)}</div>
    `;
    card.appendChild(header);

    if (data.imunisasiTerdekat) {
      const highlight = document.createElement("div");
      highlight.className = "vaccine-highlight-box";
      highlight.innerHTML = `
        <strong>⭐ Imunisasi Terdekat Berikutnya:</strong><br/>
        <strong>${escapeHtml(data.imunisasiTerdekat.namaVaksin)}</strong> (${escapeHtml(data.imunisasiTerdekat.tanggalTarget)})<br/>
        <small>${escapeHtml(data.imunisasiTerdekat.mencegah)}</small>
      `;
      card.appendChild(highlight);
    }

    const list = document.createElement("div");
    list.className = "vaccine-items-list";

    for (const item of data.jadwalLengkap) {
      const row = document.createElement("div");
      row.className = `vaccine-item-row status-${item.status}`;
      const statusLabel =
        item.status === "sudah_lewat"
          ? "Sudah Lewat"
          : item.status === "bulan_ini"
            ? "Bulan Ini"
            : "Mendatang";

      row.innerHTML = `
        <div>
          <strong>${escapeHtml(item.namaVaksin)}</strong>
          <div style="font-size:0.75rem; color:#64748b;">${escapeHtml(item.tanggalTarget)} (${item.usiaBulan} bln)</div>
        </div>
        <span class="vaccine-badge ${item.status}">${statusLabel}</span>
      `;
      list.appendChild(row);
    }

    card.appendChild(list);
    return card;
  }

  function showTyping(show) {
    if (show) {
      typingIndicator.classList.remove("hidden");
    } else {
      typingIndicator.classList.add("hidden");
    }
    scrollToBottom();
  }

  function scrollToBottom() {
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function formatMarkdown(raw) {
    if (!raw) return "";
    let escaped = escapeHtml(raw);

    escaped = escaped.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    const lines = escaped.split("\n");
    let inList = false;
    let html = "";

    for (let line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += `<li>${trimmed.substring(2)}</li>`;
      } else {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        if (trimmed.length > 0) {
          html += `<p>${trimmed}</p>`;
        }
      }
    }
    if (inList) {
      html += "</ul>";
    }

    return html;
  }
});
