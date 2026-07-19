const year = document.querySelector("#year");
const contactButton = document.querySelector("#contact-button");
const copyStatus = document.querySelector("#copy-status");
const visitCount = document.querySelector("#visit-count");
const stlForm = document.querySelector("#stl-form");
const modelList = document.querySelector("#model-list");

const VISIT_KEY = "pulse3d-site-visits";
const SESSION_VISIT_KEY = "pulse3d-session-counted";
const MODEL_KEY = "pulse3d-model-listings";

if (year) {
  year.textContent = new Date().getFullYear();
}

if (visitCount) {
  const currentVisits = Number(localStorage.getItem(VISIT_KEY) || "0");
  const hasCountedSession = sessionStorage.getItem(SESSION_VISIT_KEY) === "true";
  const visits = hasCountedSession ? currentVisits : currentVisits + 1;

  localStorage.setItem(VISIT_KEY, String(visits));
  sessionStorage.setItem(SESSION_VISIT_KEY, "true");
  visitCount.textContent = visits.toLocaleString();
}

if (contactButton && copyStatus) {
  contactButton.addEventListener("click", async () => {
    const email = "kumaraarush022@gmail.com";

    try {
      await navigator.clipboard.writeText(email);
      copyStatus.textContent = `Copied ${email}`;
    } catch {
      copyStatus.textContent = email;
    }
  });
}

const getModels = () => JSON.parse(localStorage.getItem(MODEL_KEY) || "[]");

const saveModels = (models) => {
  localStorage.setItem(MODEL_KEY, JSON.stringify(models));
};

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });

const renderModels = () => {
  if (!modelList) {
    return;
  }

  const models = getModels();

  if (models.length === 0) {
    modelList.innerHTML = '<p class="empty-list">No STL files have been uploaded yet.</p>';
    return;
  }

  modelList.innerHTML = models
    .map(
      (model) => `
        <article class="listing-card">
          <h3>${escapeHtml(model.name)}</h3>
          <p>Price: GBP ${Number(model.price).toFixed(2)}</p>
          <p>File: ${escapeHtml(model.fileName)}</p>
        </article>
      `
    )
    .join("");
};

if (stlForm) {
  stlForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = document.querySelector("#model-name").value.trim();
    const price = document.querySelector("#model-price").value;
    const file = document.querySelector("#model-file").files[0];
    const uploadStatus = document.querySelector("#upload-status");

    if (!file || !file.name.toLowerCase().endsWith(".stl")) {
      uploadStatus.textContent = "Please choose an STL file.";
      return;
    }

    const models = getModels();
    models.unshift({
      name,
      price,
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
    });

    saveModels(models);
    renderModels();
    stlForm.reset();
    uploadStatus.textContent = `${name} was added.`;
  });
}

renderModels();
