import { APP_STORAGE_KEYS, isSupabaseConfigured } from "./config.js";
import { completeOAuthCallback, currentSession, onAuthChange, signIn, signInWithGoogle, signOut, signUp } from "./services/auth.js";
import { createStudyProfile, deleteStudyProfile, getProfiles, updateStudyProfile } from "./services/profiles.js";
import { createTeacher, deleteTeacher, getTeachers, updateTeacher } from "./services/teachers.js";
import { createDiscipline, deleteDiscipline, getDisciplines, updateDiscipline } from "./services/disciplines.js";
import { applyPendingAvatar, ensureUserRecord, getUserRecord, profilePhotoUrl, provisionUserStorage, updatePersonalInfo } from "./services/users.js";
import { dashboardView } from "./ui/dashboard-view.js";
import { renderAuth } from "./ui/auth-view.js";
import { bindLayout, renderLayout } from "./ui/layout.js";
import { renderOnboarding } from "./ui/onboarding-view.js";
import { bindPersonal, personalView } from "./ui/personal-view.js";
import { bindProfiles, profilesView } from "./ui/profiles-view.js";
import { bindTeachers, openTeacherSetup, teachersView } from "./ui/teachers-view.js";
import { bindDisciplines, disciplinesView, openDisciplineSetup } from "./ui/disciplines-view.js";
import { showToast } from "./ui/components.js";
import { getStoredProfile, removeStoredProfile, storeProfile } from "./utils/formatters.js";

const root = document.querySelector("#app");
const state = {
  user: null, record: null, photoUrl: null, profiles: [], currentProfile: null, teachers: [], disciplines: [],
  view: "dashboard", returnView: "dashboard", collapsed: localStorage.getItem("akademo.sidebar.collapsed") === "true",
  theme: localStorage.getItem(APP_STORAGE_KEYS.theme) || "light",
};
let hydrationInProgressFor = null;
let googleAvatarSyncFor = null;

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#202624" : "#f7faf8");
  localStorage.setItem(APP_STORAGE_KEYS.theme, theme);
}

function renderLoading() {
  root.innerHTML = `<main class="boot-screen"><div class="boot-screen__logo"><img class="brand-icon" src="icon.png" alt=""/> AKADEMO</div><span class="spinner spinner--large"></span><p>Preparando seu espaço...</p></main>`;
}

function renderConfigurationHint() {
  root.innerHTML = `<main class="boot-screen"><div class="boot-screen__logo"><img class="brand-icon" src="icon.png" alt=""/> AKADEMO</div><section class="config-hint"><span class="config-hint__icon">!</span><h1>Conecte seu projeto Supabase</h1><p>Adicione a URL e a chave <code>anon</code> do seu projeto em <code>src/config.js</code>. Depois disso, o login e os perfis estarão prontos para funcionar.</p></section></main>`;
}

async function hydrate(user) {
  if (hydrationInProgressFor === user.id) return;
  hydrationInProgressFor = user.id;
  try {
    renderLoading();
    state.user = user;
    let record = await getUserRecord(user.id);
    if (!record) record = await ensureUserRecord(user);
    const shouldSyncGoogleAvatar = !record?.foto_perfil_path && user.app_metadata?.provider === "google";
    const pendingRecord = await applyPendingAvatar(user);
    state.record = pendingRecord || record || await getUserRecord(user.id);
    state.photoUrl = await profilePhotoUrl(state.record);
    localStorage.setItem(APP_STORAGE_KEYS.login, JSON.stringify({ userId: user.id, email: user.email }));
    state.profiles = await getProfiles(user.id);
    state.teachers = [];
    state.disciplines = [];
    selectStoredProfile();
    if (!state.profiles.length) showOnboarding();
    else renderCurrent();
    // O avatar é opcional: sincronizamos depois da interface estar disponível.
    if (shouldSyncGoogleAvatar) syncGoogleAvatarInBackground(user);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível carregar sua conta.", "error");
    renderAuthScreen();
  } finally {
    hydrationInProgressFor = null;
  }
}

function syncGoogleAvatarInBackground(user) {
  if (googleAvatarSyncFor === user.id) return;
  googleAvatarSyncFor = user.id;
  window.setTimeout(async () => {
    try {
      await provisionUserStorage();
      const refreshedRecord = await getUserRecord(user.id);
      if (state.user?.id !== user.id || !refreshedRecord?.foto_perfil_path) return;
      state.record = refreshedRecord;
      state.photoUrl = await profilePhotoUrl(refreshedRecord);
      if (state.profiles.length) renderCurrent();
    } catch (storageError) {
      console.warn("O avatar do Google não pôde ser sincronizado agora.", storageError);
    } finally {
      googleAvatarSyncFor = null;
    }
  }, 0);
}

function selectStoredProfile() {
  const stored = getStoredProfile();
  state.currentProfile = state.profiles.find((profile) => profile.id === stored?.id) || state.profiles[0] || null;
  if (state.currentProfile) storeProfile(state.currentProfile);
  else removeStoredProfile();
}

function renderAuthScreen() {
  state.user = null; state.record = null; state.photoUrl = null; state.profiles = []; state.currentProfile = null; state.teachers = []; state.disciplines = [];
  renderAuth(root, { onLogin: handleLogin, onRegister: handleRegister, onGoogle: handleGoogleLogin });
}

function showOnboarding() {
  renderOnboarding(root, {
    name: state.record?.nome || "estudante",
    onSubmit: async (values) => {
      const profile = await createStudyProfile(state.user, values);
      state.profiles = [profile]; state.currentProfile = profile; storeProfile(profile);
      showTeacherSetup(profile);
      state.view = "dashboard"; renderCurrent(); showToast("Seu perfil de estudo está pronto!");
    },
    onSignOut: handleLogout,
  });
}

function renderCurrent() {
  if (state.view === "personal") return renderPersonal();
  if (state.view === "profiles") return renderProfiles();
  if (state.view === "teachers") return renderTeachers();
  if (state.view === "disciplines") return renderDisciplines();
  renderDashboard();
}

function renderDashboard() {
  state.view = "dashboard";
  renderWithinLayout(dashboardView({ record: state.record, profile: state.currentProfile, profiles: state.profiles }));
  root.querySelector("[data-open-teachers]")?.addEventListener("click", () => {
    state.returnView = "dashboard";
    renderTeachers();
  });
  root.querySelector("[data-open-disciplines]")?.addEventListener("click", () => {
    state.returnView = "dashboard";
    renderDisciplines();
  });
}

function renderPersonal() {
  state.view = "personal";
  renderWithinLayout(personalView({ record: state.record, photoUrl: state.photoUrl }));
  bindPersonal(root, {
    record: state.record, photoUrl: state.photoUrl,
    onBack: () => { state.view = state.returnView; renderCurrent(); },
    onSave: async (values) => {
      state.record = await updatePersonalInfo(state.user, values);
      state.photoUrl = await profilePhotoUrl(state.record);
      renderPersonal(); showToast("Informações atualizadas com sucesso.");
    },
  });
}

function renderProfiles() {
  state.view = "profiles";
  renderWithinLayout(profilesView({ profiles: state.profiles, currentProfile: state.currentProfile }));
  bindProfiles(root, {
    profiles: state.profiles,
    onBack: () => { state.view = state.returnView; renderCurrent(); },
    onCreate: async (values) => {
      const profile = await createStudyProfile(state.user, values);
      state.profiles = [...state.profiles, profile];
      state.currentProfile = profile; storeProfile(profile); state.teachers = []; state.disciplines = [];
      renderProfiles(); showToast("Novo perfil criado.");
      return profile;
    },
    onCreated: (profile) => showTeacherSetup(profile),
    onUpdate: async (id, values) => {
      const updated = await updateStudyProfile(id, values);
      state.profiles = state.profiles.map((profile) => profile.id === id ? updated : profile);
      if (state.currentProfile?.id === id) { state.currentProfile = updated; storeProfile(updated); }
      renderProfiles(); showToast("Perfil atualizado.");
    },
    onDelete: async (profile) => {
      try {
        await deleteStudyProfile(profile.id);
        state.profiles = state.profiles.filter((item) => item.id !== profile.id);
        if (!state.profiles.length) { state.currentProfile = null; removeStoredProfile(); showToast("Perfil removido."); return showOnboarding(); }
        if (state.currentProfile?.id === profile.id) { state.currentProfile = state.profiles[0]; state.teachers = []; state.disciplines = []; storeProfile(state.currentProfile); }
        renderProfiles(); showToast("Perfil removido.");
      } catch (error) { showToast(error.message || "Não foi possível excluir o perfil.", "error"); }
    },
  });
}

function showTeacherSetup(profile) {
  openTeacherSetup({
    profile,
    onCreate: async (values) => {
      const teacher = await createTeacher(state.user, profile, values);
      if (state.currentProfile?.id === profile.id) state.teachers = [...state.teachers, teacher];
      return teacher;
    },
    onUpdate: async (id, values) => {
      const updated = await updateTeacher(id, profile.id, values);
      if (state.currentProfile?.id === profile.id) state.teachers = state.teachers.map((teacher) => teacher.id === id ? updated : teacher);
      return updated;
    },
    onDelete: async (id) => {
      await deleteTeacher(id, profile.id);
      if (state.currentProfile?.id === profile.id) state.teachers = state.teachers.filter((teacher) => teacher.id !== id);
      if (state.currentProfile?.id === profile.id) state.disciplines = state.disciplines.filter((discipline) => discipline.professor_id !== id);
    },
    onFinish: (count) => {
      showToast(count ? "Professores cadastrados com sucesso." : "Você poderá cadastrar professores mais tarde.");
      showDisciplineSetup(profile);
    },
  });
}

async function renderTeachers() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "teachers";
  try {
    const [teachers, disciplines] = await Promise.all([getTeachers(profile.id), getDisciplines(profile.id)]);
    if (state.view !== "teachers" || state.currentProfile?.id !== profile.id) return;
    state.teachers = teachers;
    state.disciplines = disciplines;
    mountTeachers();
  } catch (error) {
    showToast(error.message || "Não foi possível carregar os professores.", "error");
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountTeachers() {
  renderWithinLayout(teachersView({ profile: state.currentProfile, teachers: state.teachers, disciplines: state.disciplines }));
  bindTeachers(root, {
    teachers: state.teachers,
    onBack: () => { state.view = state.returnView; renderCurrent(); },
    onCreate: async (values) => {
      const teacher = await createTeacher(state.user, state.currentProfile, values);
      state.teachers = [...state.teachers, teacher];
      mountTeachers(); showToast("Professor adicionado com sucesso.");
      return teacher;
    },
    onUpdate: async (id, values) => {
      const updated = await updateTeacher(id, state.currentProfile.id, values);
      state.teachers = state.teachers.map((teacher) => teacher.id === id ? updated : teacher);
      mountTeachers(); showToast("Professor atualizado com sucesso.");
      return updated;
    },
    onDelete: async (teacher) => {
      await deleteTeacher(teacher.id, state.currentProfile.id);
      state.teachers = state.teachers.filter((item) => item.id !== teacher.id);
      state.disciplines = state.disciplines.filter((discipline) => discipline.professor_id !== teacher.id);
      mountTeachers(); showToast("Professor removido.");
    },
  });
}

function showDisciplineSetup(profile) {
  openDisciplineSetup({
    profile,
    teachers: state.teachers,
    onCreate: async (values) => {
      const discipline = await createDiscipline(state.user, profile, values);
      if (state.currentProfile?.id === profile.id) state.disciplines = [...state.disciplines, discipline];
      return discipline;
    },
    onUpdate: async (id, values) => {
      const updated = await updateDiscipline(id, profile.id, values);
      if (state.currentProfile?.id === profile.id) state.disciplines = state.disciplines.map((discipline) => discipline.id === id ? updated : discipline);
      return updated;
    },
    onDelete: async (id) => {
      await deleteDiscipline(id, profile.id);
      if (state.currentProfile?.id === profile.id) state.disciplines = state.disciplines.filter((discipline) => discipline.id !== id);
    },
    onFinish: (count) => showToast(count ? "Disciplinas cadastradas com sucesso." : "Você poderá cadastrar disciplinas mais tarde."),
  });
}

async function renderDisciplines() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "disciplines";
  try {
    const [teachers, disciplines] = await Promise.all([getTeachers(profile.id), getDisciplines(profile.id)]);
    if (state.view !== "disciplines" || state.currentProfile?.id !== profile.id) return;
    state.teachers = teachers;
    state.disciplines = disciplines;
    mountDisciplines();
  } catch (error) {
    showToast(error.message || "Não foi possível carregar as disciplinas.", "error");
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountDisciplines() {
  renderWithinLayout(disciplinesView({ profile: state.currentProfile, teachers: state.teachers, disciplines: state.disciplines }));
  bindDisciplines(root, {
    teachers: state.teachers,
    disciplines: state.disciplines,
    onBack: () => { state.view = state.returnView; renderCurrent(); },
    onCreate: async (values) => {
      const discipline = await createDiscipline(state.user, state.currentProfile, values);
      state.disciplines = [...state.disciplines, discipline];
      mountDisciplines(); showToast("Disciplina adicionada com sucesso.");
      return discipline;
    },
    onUpdate: async (id, values) => {
      const updated = await updateDiscipline(id, state.currentProfile.id, values);
      state.disciplines = state.disciplines.map((discipline) => discipline.id === id ? updated : discipline);
      mountDisciplines(); showToast("Disciplina atualizada com sucesso.");
      return updated;
    },
    onDelete: async (discipline) => {
      await deleteDiscipline(discipline.id, state.currentProfile.id);
      state.disciplines = state.disciplines.filter((item) => item.id !== discipline.id);
      mountDisciplines(); showToast("Disciplina removida.");
    },
  });
}

function renderWithinLayout(content) {
  renderLayout(root, { ...state, content });
  bindLayout(root, {
    onCollapse: () => { state.collapsed = !state.collapsed; localStorage.setItem("akademo.sidebar.collapsed", state.collapsed); renderCurrent(); },
    onNavigate: (view) => { state.view = view; renderCurrent(); },
    onPersonal: () => { state.returnView = state.view; renderPersonal(); },
    onProfiles: () => { state.returnView = state.view; renderProfiles(); },
    onTeachers: () => { state.returnView = state.view; renderTeachers(); },
    onDisciplines: () => { state.returnView = state.view; renderDisciplines(); },
    onProfileChange: (id) => { state.currentProfile = state.profiles.find((profile) => profile.id === id); state.teachers = []; state.disciplines = []; storeProfile(state.currentProfile); renderCurrent(); showToast("Perfil ativo alterado."); },
    onTheme: (event) => { applyTheme(event.target.checked ? "dark" : "light"); renderCurrent(); },
    onLogout: handleLogout,
  });
}

async function handleLogin(email, password) {
  await signIn(email, password);
  // onAuthStateChange hidrata o aplicativo. Esta mensagem só cobre atrasos de rede.
}

async function handleGoogleLogin() {
  await signInWithGoogle();
}

async function handleRegister({ name, email, password, photo }) {
  if (photo) {
    const { fileToDataUrl } = await import("./utils/formatters.js");
    const dataUrl = await fileToDataUrl(photo);
    try {
      localStorage.setItem(APP_STORAGE_KEYS.pendingAvatar, JSON.stringify({ email, name, dataUrl, fileName: photo.name, type: photo.type }));
    } catch {
      showToast("Sua conta será criada sem a foto. Você poderá adicioná-la depois em Informações.", "error");
    }
  }
  const result = await signUp({ name, email, password });
  if (!result.session) showToast("Conta criada. Confirme seu e-mail e depois entre para finalizar seu perfil.");
}

async function handleLogout() {
  try { await signOut(); renderAuthScreen(); showToast("Você saiu da sua conta."); }
  catch (error) { showToast(error.message || "Não foi possível sair agora.", "error"); }
}

async function boot() {
  applyTheme(state.theme);
  // A primeira tela permanece o login mesmo antes da configuração; as ações explicam
  // exatamente o que falta em vez de expor uma tela técnica para quem vai usar o sistema.
  if (!isSupabaseConfigured()) return renderAuthScreen();
  renderLoading();
  try {
    // Em OAuth/PKCE o Google retorna ?code=...; trocamos esse código por sessão antes
    // de consultar a sessão normal, sem depender de uma corrida de eventos do navegador.
    const callbackSession = await completeOAuthCallback();
    onAuthChange((event, session) => {
      if (event === "SIGNED_OUT") return renderAuthScreen();
      // TOKEN_REFRESHED e retomadas de aba são normais: não redesenhe a interface
      // nem mostre a tela de carregamento para uma sessão que já está em uso.
      const shouldLoadAccount = (event === "SIGNED_IN" || event === "USER_UPDATED")
        && session?.user && state.user?.id !== session.user.id;
      if (shouldLoadAccount) hydrate(session.user);
    });
    const session = callbackSession || await currentSession();
    if (session?.user) await hydrate(session.user); else renderAuthScreen();
  } catch (error) {
    console.error(error); renderAuthScreen(); showToast(error.message || "Não foi possível iniciar o AKADEMO.", "error");
  }
}

boot();
