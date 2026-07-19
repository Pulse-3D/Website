const year = document.querySelector("#year");
const contactButton = document.querySelector("#contact-button");
const copyStatus = document.querySelector("#copy-status");
const visitCount = document.querySelector("#visit-count");
const adminStatus = document.querySelector("#admin-status");
const logoutButton = document.querySelector("#logout-button");
const stlForm = document.querySelector("#stl-form");
const uploadPanel = document.querySelector(".upload-panel");
const modelList = document.querySelector("#model-list");
const designSearch = document.querySelector("#design-search");
const shopStatus = document.querySelector("#shop-status");
const authForm = document.querySelector("#auth-form");
const registerForm = document.querySelector("#register-form");

const VISIT_KEY = "pulse3d-site-visits";
const SESSION_VISIT_KEY = "pulse3d-session-counted";
const MODEL_KEY = "pulse3d-model-listings";
const CONTACT_EMAIL = "kumaraarush022@gmail.com";
let currentUser = null;
let cachedModels = [];

if (year) {
  year.textContent = new Date().getFullYear();
}

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong.");
  }
  return data;
};

if (visitCount) {
  const currentVisits = Number(localStorage.getItem(VISIT_KEY) || "0");
  const hasCountedSession = sessionStorage.getItem(SESSION_VISIT_KEY) === "true";
  const visits = hasCountedSession ? currentVisits : currentVisits + 1;

  localStorage.setItem(VISIT_KEY, String(visits));
  sessionStorage.setItem(SESSION_VISIT_KEY, "true");
  visitCount.textContent = visits.toLocaleString();

  api("/api/visits")
    .then((data) => {
      visitCount.textContent = Number(data.count).toLocaleString();
    })
    .catch(() => {});
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

const setAdminState = () => {
  if (!uploadPanel) {
    return;
  }

  const unlocked = currentUser && currentUser.role === "admin";
  uploadPanel.hidden = !unlocked;
  if (logoutButton) {
    logoutButton.hidden = !unlocked;
  }
  if (adminStatus) {
    adminStatus.textContent = unlocked
      ? `Logged in as ${currentUser.email}. Upload tools are unlocked.`
      : "Admin login required before uploading designs.";
  }
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

  const query = designSearch ? designSearch.value.trim().toLowerCase() : "";
  const filteredModels = cachedModels.filter((model) =>
    `${model.name} ${model.fileName}`.toLowerCase().includes(query)
  );

  if (cachedModels.length === 0) {
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
          <button class="button primary buy-button" type="button" data-design-id="${model.id}" data-mailto="mailto:${CONTACT_EMAIL}?subject=${buySubject}&body=${buyBody}">
            Buy design
          </button>
        </article>
      `;
      }
    )
    .join("");
};

const loadUser = async () => {
  try {
    const data = await api("/api/me");
    currentUser = data.authenticated ? data : null;
  } catch {
    currentUser = null;
  }
  setAdminState();
};

const loadModels = async () => {
  try {
    const data = await api("/api/designs");
    cachedModels = data.designs;
  } catch {
    cachedModels = JSON.parse(localStorage.getItem(MODEL_KEY) || "[]");
    if (shopStatus) {
      shopStatus.textContent = "Start the backend server to load shared designs.";
    }
  }
  renderModels();
};

if (stlForm) {
  stlForm.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!currentUser || currentUser.role !== "admin") {
      document.querySelector("#upload-status").textContent = "Unlock admin uploads first.";
      return;
    }

    const file = document.querySelector("#model-file").files[0];
    const uploadStatus = document.querySelector("#upload-status");

    if (!file || !file.name.toLowerCase().endsWith(".stl")) {
      uploadStatus.textContent = "Please choose an STL file.";
      return;
    }

    api("/api/designs", {
      method: "POST",
      body: new FormData(stlForm),
    })
      .then((data) => {
        cachedModels.unshift(data.design);
        renderModels();
        stlForm.reset();
        uploadStatus.textContent = `${data.design.name} was added.`;
      })
      .catch((error) => {
        uploadStatus.textContent = error.message;
      });
  });
}

if (designSearch) {
  designSearch.addEventListener("input", renderModels);
}

if (modelList) {
  modelList.addEventListener("click", (event) => {
    const button = event.target.closest(".buy-button");
    if (!button) {
      return;
    }

    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }

    api("/api/purchases", {
      method: "POST",
      body: JSON.stringify({ designId: Number(button.dataset.designId) }),
    })
      .then((data) => {
        if (shopStatus) {
          shopStatus.textContent = data.message;
        }
        window.location.href = button.dataset.mailto;
      })
      .catch((error) => {
        if (shopStatus) {
          shopStatus.textContent = error.message;
        }
      });
  });
}

const handleLogin = (form, statusElement) => {
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);

    api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    })
      .then((user) => {
        if (statusElement) {
          statusElement.textContent = "Logged in.";
        }
        window.location.href = user.role === "admin" ? "admin.html" : "models.html";
      })
      .catch((error) => {
        if (statusElement) {
          statusElement.textContent = error.message || "Invalid email or password.";
        }
      });
  });
};

const handleRegister = (form, statusElement) => {
  if (!form) {
    return;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password.length < 8) {
      if (statusElement) {
        statusElement.textContent = "Password must be at least 8 characters.";
      }
      return;
    }

    if (password !== confirmPassword) {
      if (statusElement) {
        statusElement.textContent = "Passwords do not match.";
      }
      return;
    }

    api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password,
      }),
    })
      .then(() => {
        if (statusElement) {
          statusElement.textContent = "Account created. You can now log in.";
        }
        window.location.href = "login.html";
      })
      .catch((error) => {
        if (statusElement) {
          statusElement.textContent = error.message || "Unable to create account.";
        }
      });
  });
};

handleLogin(authForm, document.querySelector("#auth-status"));
handleRegister(registerForm, document.querySelector("#register-status"));

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    api("/api/logout", { method: "POST", body: JSON.stringify({}) }).then(() => {
      currentUser = null;
      setAdminState();
    });
  });
}

loadUser().then(loadModels);
