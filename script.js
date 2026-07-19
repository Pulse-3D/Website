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
const loginButton = document.querySelector("#login-button");
const registerForm = document.querySelector("#register-form");
const authNav = document.querySelector("#auth-nav");
const profileMenuWrapper = document.querySelector("#profile-menu-wrapper");
const profileToggle = document.querySelector("#profile-toggle");
const profileDropdown = document.querySelector("#profile-dropdown");
const heroAuthActions = document.querySelector("#hero-auth-actions");
const signoutButton = document.querySelector("#signout-button");

const VISIT_KEY = "pulse3d-site-visits";
const SESSION_VISIT_KEY = "pulse3d-session-counted";
const MODEL_KEY = "pulse3d-model-listings";
const CONTACT_EMAIL = "kumaraarush022@gmail.com";
const PURCHASED_KEY = "pulse3d-purchased-designs";
const USER_KEY = "pulse3d-current-user";
let currentUser = null;
let cachedModels = [];

const getPurchasedDesignIds = () => {
  try {
    return JSON.parse(localStorage.getItem(PURCHASED_KEY) || "[]");
  } catch {
    return [];
  }
};

const savePurchasedDesignIds = (designIds) => {
  localStorage.setItem(PURCHASED_KEY, JSON.stringify(designIds));
};

const saveCurrentUser = (user) => {
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
};

const renderProfilePage = () => {
  const profileStatus = document.querySelector("#profile-status");
  if (profileStatus) {
    profileStatus.textContent = currentUser
      ? `Signed in as ${currentUser.email}.`
      : "Please sign in to view your account details.";
  }
};

const renderPurchasedItems = () => {
  const purchasesList = document.querySelector("#purchases-list");
  if (!purchasesList) {
    return;
  }

  const purchasedDesignIds = getPurchasedDesignIds();
  if (purchasedDesignIds.length === 0) {
    purchasesList.innerHTML = '<p class="empty-list">You have not purchased any designs yet.</p>';
    return;
  }

  const purchasedModels = cachedModels.filter((model) =>
    purchasedDesignIds.includes(String(model.id))
  );

  if (purchasedModels.length === 0) {
    purchasesList.innerHTML = '<p class="empty-list">Your purchased designs are still loading.</p>';
    return;
  }

  purchasesList.innerHTML = purchasedModels
    .map((model) => {
      const name = escapeHtml(model.name);
      const price = Number(model.price).toFixed(2);
      return `
        <article class="listing-card purchased-card">
          <h3>${name}</h3>
          <p>Price: GBP ${price}</p>
          <a class="button secondary" href="/api/designs/${model.id}/download" target="_blank" rel="noopener">Download STL</a>
        </article>
      `;
    })
    .join("");
};

if (year) {
  year.textContent = new Date().getFullYear();
}

const api = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json" },
    ...options,
  });

  const contentType = response.headers.get("Content-Type") || "";
  let data;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (typeof data === "object" && data !== null) {
      throw new Error(data.error || "Something went wrong.");
    }
    throw new Error(typeof data === "string" ? data : "Something went wrong.");
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

  const purchasedDesignIds = getPurchasedDesignIds();

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
        const isPurchased = purchasedDesignIds.includes(String(model.id));

        return `
        <article class="listing-card ${isPurchased ? "purchased-card" : ""}">
          <p class="listing-number">Design ${index + 1}</p>
          <h3>${name}</h3>
          <p>Price: GBP ${price}</p>
          <p>File: ${fileName}</p>
          ${isPurchased ? '<p class="purchase-status">Purchased</p>' : ""}
          <div class="auth-actions">
            <button class="button primary buy-button" type="button" data-design-id="${model.id}" data-mailto="mailto:${CONTACT_EMAIL}?subject=${buySubject}&body=${buyBody}">
              ${isPurchased ? "Buy again" : "Buy design"}
            </button>
            ${isPurchased ? `<a class="button secondary" href="/api/designs/${model.id}/download" target="_blank" rel="noopener">Download STL</a>` : ""}
          </div>
        </article>
      `;
      }
    )
    .join("");
};

const updateProfileUI = () => {
  if (authNav) {
    authNav.hidden = Boolean(currentUser);
  }
  if (profileMenuWrapper) {
    profileMenuWrapper.hidden = !currentUser;
  }
  if (heroAuthActions) {
    heroAuthActions.hidden = Boolean(currentUser);
  }
  if (currentUser && profileToggle) {
    profileToggle.textContent = currentUser.email.charAt(0).toUpperCase();
  }
};

const loadUser = async () => {
  try {
    const data = await api("/api/me");
    currentUser = data.authenticated ? data : null;
  } catch {
    currentUser = null;
  }

  if (!currentUser) {
    try {
      const storedUser = JSON.parse(localStorage.getItem(USER_KEY) || "null");
      if (storedUser && storedUser.email) {
        currentUser = storedUser;
      }
    } catch {
      currentUser = null;
    }
  }

  saveCurrentUser(currentUser);
  setAdminState();
  updateProfileUI();
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

    api("/api/purchases", {
      method: "POST",
      body: JSON.stringify({ designId: Number(button.dataset.designId) }),
    })
      .then((data) => {
        const purchasedDesignIds = getPurchasedDesignIds();
        if (!purchasedDesignIds.includes(String(button.dataset.designId))) {
          purchasedDesignIds.push(String(button.dataset.designId));
          savePurchasedDesignIds(purchasedDesignIds);
        }
        if (shopStatus) {
          shopStatus.textContent = `${data.message} You can now download the STL after purchase.`;
        }
        renderModels();
        window.open(button.dataset.mailto, "_blank", "noopener,noreferrer");
      })
      .catch((error) => {
        if (shopStatus) {
          shopStatus.textContent = error.message;
        }
      });
  });
}

const handleLogin = (form, button, statusElement) => {
  if (!form || !button) {
    return;
  }

  const submitLogin = () => {
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
        currentUser = user;
        saveCurrentUser(currentUser);
        updateProfileUI();
        window.location.replace(user.role === "admin" ? "admin.html" : "index.html");
      })
      .catch((error) => {
        if (statusElement) {
          statusElement.textContent = error.message || "Invalid email or password.";
        }
      });
  };

  button.addEventListener("click", (event) => {
    event.preventDefault();
    submitLogin();
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    submitLogin();
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

handleLogin(authForm, loginButton, document.querySelector("#auth-status"));
handleRegister(registerForm, document.querySelector("#register-status"));

if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    api("/api/logout", { method: "POST", body: JSON.stringify({}) }).then(() => {
      currentUser = null;
      saveCurrentUser(null);
      setAdminState();
      updateProfileUI();
      window.location.replace("index.html");
    });
  });
}

if (profileToggle && profileDropdown) {
  profileToggle.addEventListener("click", () => {
    const isHidden = profileDropdown.hidden;
    profileDropdown.hidden = !isHidden;
    profileToggle.setAttribute("aria-expanded", String(isHidden));
  });
}

if (signoutButton) {
  signoutButton.addEventListener("click", () => {
    api("/api/logout", { method: "POST", body: JSON.stringify({}) }).then(() => {
      currentUser = null;
      saveCurrentUser(null);
      setAdminState();
      updateProfileUI();
      window.location.replace("index.html");
    });
  });
}

loadUser()
  .then(() => loadModels())
  .then(() => {
    renderProfilePage();
    renderPurchasedItems();
  });
