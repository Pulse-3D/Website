const year = document.querySelector("#year");
const contactButton = document.querySelector("#contact-button");
const copyStatus = document.querySelector("#copy-status");
const visitCount = document.querySelector("#visit-count");
const adminForm = document.querySelector("#admin-form");
const adminCode = document.querySelector("#admin-code");
const adminLock = document.querySelector("#admin-lock");
const adminStatus = document.querySelector("#admin-status");
const stlForm = document.querySelector("#stl-form");
const uploadPanel = document.querySelector(".upload-panel");
const modelList = document.querySelector("#model-list");
const designSearch = document.querySelector("#design-search");

const VISIT_KEY = "pulse3d-site-visits";
const SESSION_VISIT_KEY = "pulse3d-session-counted";
const MODEL_KEY = "pulse3d-model-listings";
const ADMIN_KEY = "pulse3d-admin-unlocked";
const ADMIN_CODE = "pulse3d-owner";
const CONTACT_EMAIL = "kumaraarush022@gmail.com";

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
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      copyStatus.textContent = `Copied ${CONTACT_EMAIL}`;
    } catch {
      copyStatus.textContent = CONTACT_EMAIL;
    }
  });
}

const getModels = () => JSON.parse(localStorage.getItem(MODEL_KEY) || "[]");

const saveModels = (models) => {
  localStorage.setItem(MODEL_KEY, JSON.stringify(models));
};

const isAdminUnlocked = () => sessionStorage.getItem(ADMIN_KEY) === "true";

const setAdminState = (unlocked) => {
  if (!uploadPanel) {
    return;
  }

  uploadPanel.hidden = !unlocked;
  adminLock.hidden = !unlocked;
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
  const query = designSearch ? designSearch.value.trim().toLowerCase() : "";
  const filteredModels = models.filter((model) =>
    `${model.name} ${model.fileName}`.toLowerCase().includes(query)
  );

  if (models.length === 0) {
    modelList.innerHTML = '<p class="empty-list">No designs are available yet.</p>';
    return;
  }

  if (filteredModels.length === 0) {
    modelList.innerHTML = '<p class="empty-list">No designs match your search.</p>';
    return;
  }

  modelList.innerHTML = filteredModels
    .map(
      (model, index) => {
        const name = escapeHtml(model.name);
        const price = Number(model.price).toFixed(2);
        const fileName = escapeHtml(model.fileName);
        const buySubject = encodeURIComponent(`Buy ${model.name} from Pulse 3D`);
        const buyBody = encodeURIComponent(
          `Hi, I would like to buy "${model.name}" for GBP ${price}.`
        );

        return `
        <article class="listing-card">
          <p class="listing-number">Design ${index + 1}</p>
          <h3>${name}</h3>
          <p>Price: GBP ${price}</p>
          <p>File: ${fileName}</p>
          <a class="button primary buy-button" href="mailto:${CONTACT_EMAIL}?subject=${buySubject}&body=${buyBody}">
            Buy design
          </a>
        </article>
      `;
      }
    )
    .join("");
};

if (adminForm && adminCode && adminStatus) {
  setAdminState(isAdminUnlocked());

  adminForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (adminCode.value === ADMIN_CODE) {
      sessionStorage.setItem(ADMIN_KEY, "true");
      adminStatus.textContent = "Upload tools unlocked.";
      adminCode.value = "";
      setAdminState(true);
      return;
    }

    adminStatus.textContent = "That admin code is not correct.";
  });
}

if (adminLock) {
  adminLock.addEventListener("click", () => {
    sessionStorage.removeItem(ADMIN_KEY);
    setAdminState(false);

    if (adminStatus) {
      adminStatus.textContent = "Upload tools locked.";
    }
  });
}

if (stlForm) {
  stlForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!isAdminUnlocked()) {
      document.querySelector("#upload-status").textContent = "Unlock admin uploads first.";
      return;
    }

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

if (designSearch) {
  designSearch.addEventListener("input", renderModels);
}

renderModels();
