import { APP_STORAGE_KEYS, isSupabaseConfigured } from "./config.js";
import {
  completeOAuthCallback,
  currentSession,
  onAuthChange,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
} from "./services/auth.js";
import {
  createStudyProfile,
  deleteStudyProfile,
  getProfiles,
  updateStudyProfile,
} from "./services/profiles.js";
import {
  createTeacher,
  deleteTeacher,
  getTeachers,
  updateTeacher,
} from "./services/teachers.js";
import {
  createDiscipline,
  deleteDiscipline,
  getDisciplines,
  updateDiscipline,
} from "./services/disciplines.js";
import {
  createSchedule,
  deleteSchedule,
  getNextClass,
  getSchedules,
  updateSchedule,
} from "./services/schedules.js";
import {
  createChronogramEntry,
  deleteChronogramEntry,
  findChronogramEntry,
  getChronogram,
  getLessonOccurrences,
  updateChronogramEntry,
} from "./services/chronogram.js";
import {
  createLesson,
  deleteContent,
  getContentUrl,
  getContents,
  getLessonByChronogram,
  getLessons,
  getWeekOccurrences,
  startOfWeek,
  uploadContent,
} from "./services/lessons.js";
import {
  applyPendingAvatar,
  ensureUserRecord,
  getUserRecord,
  profilePhotoUrl,
  provisionUserStorage,
  updatePersonalInfo,
} from "./services/users.js";
import { dashboardView } from "./ui/dashboard-view.js";
import { renderAuth } from "./ui/auth-view.js";
import { bindLayout, renderLayout } from "./ui/layout.js";
import { renderOnboarding } from "./ui/onboarding-view.js";
import { bindPersonal, personalView } from "./ui/personal-view.js";
import { bindProfiles, profilesView } from "./ui/profiles-view.js";
import {
  bindTeachers,
  openTeacherSetup,
  teachersView,
} from "./ui/teachers-view.js";
import {
  bindDisciplines,
  disciplinesView,
  openDisciplineSetup,
} from "./ui/disciplines-view.js";
import { bindSchedules, schedulesView } from "./ui/schedules-view.js";
import { bindChronogram, chronogramView } from "./ui/chronogram-view.js";
import {
  bindLessonChronogram,
  bindLessonDetail,
  bindLessonForm,
  bindLessonMaterials,
  bindLessonsWeek,
  lessonChronogramView,
  lessonDetailView,
  lessonFormView,
  lessonMaterialsView,
  lessonsWeekView,
} from "./ui/lessons-view.js";
import { showToast } from "./ui/components.js";
import {
  getStoredProfile,
  removeStoredProfile,
  storeProfile,
} from "./utils/formatters.js";

const root = document.querySelector("#app");
const state = {
  user: null,
  record: null,
  photoUrl: null,
  profiles: [],
  currentProfile: null,
  teachers: [],
  disciplines: [],
  schedules: [],
  chronograms: [],
  lessons: [],
  scheduleEditing: false,
  chronogramDisciplineId: null,
  lessonWeekOffset: 0,
  lessonOccurrence: null,
  lessonChronogram: null,
  activeLesson: null,
  activeLessonContents: [],
  dashboardLoadedProfileId: null,
  view: "dashboard",
  returnView: "dashboard",
  collapsed: localStorage.getItem("akademo.sidebar.collapsed") === "true",
  theme: localStorage.getItem(APP_STORAGE_KEYS.theme) || "light",
};
let hydrationInProgressFor = null;
let googleAvatarSyncFor = null;

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#1b2d22" : "#eef4ef");
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
    const shouldSyncGoogleAvatar =
      !record?.foto_perfil_path && user.app_metadata?.provider === "google";
    const pendingRecord = await applyPendingAvatar(user);
    state.record = pendingRecord || record || (await getUserRecord(user.id));
    state.photoUrl = await profilePhotoUrl(state.record);
    localStorage.setItem(
      APP_STORAGE_KEYS.login,
      JSON.stringify({ userId: user.id, email: user.email }),
    );
    state.profiles = await getProfiles(user.id);
    state.teachers = [];
    state.disciplines = [];
    state.schedules = [];
    state.chronograms = [];
    state.lessons = [];
    state.scheduleEditing = false;
    state.chronogramDisciplineId = null;
    state.lessonWeekOffset = 0;
    state.lessonOccurrence = null;
    state.lessonChronogram = null;
    state.activeLesson = null;
    state.activeLessonContents = [];
    state.dashboardLoadedProfileId = null;
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
      if (state.user?.id !== user.id || !refreshedRecord?.foto_perfil_path)
        return;
      state.record = refreshedRecord;
      state.photoUrl = await profilePhotoUrl(refreshedRecord);
      if (state.profiles.length) renderCurrent();
    } catch (storageError) {
      console.warn(
        "O avatar do Google não pôde ser sincronizado agora.",
        storageError,
      );
    } finally {
      googleAvatarSyncFor = null;
    }
  }, 0);
}

function selectStoredProfile() {
  const stored = getStoredProfile();
  state.currentProfile =
    state.profiles.find((profile) => profile.id === stored?.id) ||
    state.profiles[0] ||
    null;
  if (state.currentProfile) storeProfile(state.currentProfile);
  else removeStoredProfile();
}

function renderAuthScreen() {
  state.user = null;
  state.record = null;
  state.photoUrl = null;
  state.profiles = [];
  state.currentProfile = null;
  state.teachers = [];
  state.disciplines = [];
  state.schedules = [];
  state.chronograms = [];
  state.lessons = [];
  state.scheduleEditing = false;
  state.chronogramDisciplineId = null;
  state.lessonWeekOffset = 0;
  state.lessonOccurrence = null;
  state.lessonChronogram = null;
  state.activeLesson = null;
  state.activeLessonContents = [];
  state.dashboardLoadedProfileId = null;
  renderAuth(root, {
    onLogin: handleLogin,
    onRegister: handleRegister,
    onGoogle: handleGoogleLogin,
  });
}

function showOnboarding() {
  renderOnboarding(root, {
    name: state.record?.nome || "estudante",
    onSubmit: async (values) => {
      const profile = await createStudyProfile(state.user, values);
      state.profiles = [profile];
      state.currentProfile = profile;
      storeProfile(profile);
      showTeacherSetup(profile);
      state.view = "dashboard";
      renderCurrent();
      showToast("Seu perfil de estudo está pronto!");
    },
    onSignOut: handleLogout,
  });
}

function renderCurrent() {
  if (state.view === "personal") return renderPersonal();
  if (state.view === "profiles") return renderProfiles();
  if (state.view === "teachers") return renderTeachers();
  if (state.view === "disciplines") return renderDisciplines();
  if (state.view === "schedules") return renderSchedules();
  if (state.view === "chronogram") return renderChronogram();
  if (state.view === "lessons") return renderLessons();
  if (state.view === "lesson-chronogram") return renderLessonChronogram();
  if (state.view === "lesson-form") return renderLessonForm();
  if (state.view === "lesson-detail") return renderLessonDetail();
  if (state.view === "lesson-materials") return renderLessonMaterials();
  renderDashboard();
}

function renderDashboard() {
  state.view = "dashboard";
  mountDashboard();
  if (
    state.currentProfile &&
    state.dashboardLoadedProfileId !== state.currentProfile.id
  )
    loadDashboardData(state.currentProfile);
}

function mountDashboard() {
  const nextClass = getNextClass(
    state.schedules,
    state.disciplines,
    state.teachers,
  );
  const nextClassChronogram = nextClass
    ? findChronogramEntry(
        state.chronograms,
        nextClass.schedule.disciplina,
        nextClass.start,
      )
    : null;
  renderWithinLayout(
    dashboardView({
      record: state.record,
      profile: state.currentProfile,
      profiles: state.profiles,
      nextClass,
      nextClassChronogram,
      isNextClassLoading:
        state.currentProfile &&
        state.dashboardLoadedProfileId !== state.currentProfile.id,
    }),
  );
  root.querySelector("[data-open-teachers]")?.addEventListener("click", () => {
    state.returnView = "dashboard";
    renderTeachers();
  });
  root
    .querySelector("[data-open-disciplines]")
    ?.addEventListener("click", () => {
      state.returnView = "dashboard";
      renderDisciplines();
    });
  root.querySelector("[data-open-profiles]")?.addEventListener("click", () => {
    state.returnView = "dashboard";
    renderProfiles();
  });
  root.querySelector("[data-open-schedules]")?.addEventListener("click", () => {
    state.returnView = "dashboard";
    renderSchedules();
  });
  root
    .querySelector("[data-open-next-class]")
    ?.addEventListener("click", () => {
      if (!nextClass) return;
      openLessonOccurrence(
        {
          key: `${nextClass.schedule.id}:${nextClass.start.toISOString()}`,
          schedule: nextClass.schedule,
          discipline: nextClass.discipline,
          startsAt: nextClass.start,
          endsAt: nextClass.end,
        },
        "dashboard",
      ).catch((error) =>
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel abrir a aula.",
          "error",
        ),
      );
    });
}

async function loadDashboardData(profile) {
  try {
    const [teachers, disciplines, schedules, chronograms] = await Promise.all([
      getTeachers(profile.id),
      getDisciplines(profile.id),
      getSchedules(profile.id),
      getChronogram(profile.id),
    ]);
    if (state.view !== "dashboard" || state.currentProfile?.id !== profile.id)
      return;
    state.teachers = teachers;
    state.disciplines = disciplines;
    state.schedules = schedules;
    state.chronograms = chronograms;
    state.dashboardLoadedProfileId = profile.id;
    mountDashboard();
  } catch (error) {
    if (state.view === "dashboard" && state.currentProfile?.id === profile.id) {
      state.dashboardLoadedProfileId = profile.id;
      mountDashboard();
      showToast(
        error.message || "Não foi possível carregar a próxima aula.",
        "error",
      );
    }
  }
}

function renderPersonal() {
  state.view = "personal";
  renderWithinLayout(
    personalView({ record: state.record, photoUrl: state.photoUrl }),
  );
  bindPersonal(root, {
    record: state.record,
    photoUrl: state.photoUrl,
    onBack: () => {
      state.view = state.returnView;
      renderCurrent();
    },
    onSave: async (values) => {
      state.record = await updatePersonalInfo(state.user, values);
      state.photoUrl = await profilePhotoUrl(state.record);
      renderPersonal();
      showToast("Informações atualizadas com sucesso.");
    },
  });
}

function renderProfiles() {
  state.view = "profiles";
  renderWithinLayout(
    profilesView({
      profiles: state.profiles,
      currentProfile: state.currentProfile,
    }),
  );
  bindProfiles(root, {
    profiles: state.profiles,
    onBack: () => {
      state.view = state.returnView;
      renderCurrent();
    },
    onCreate: async (values) => {
      const profile = await createStudyProfile(state.user, values);
      state.profiles = [...state.profiles, profile];
      state.currentProfile = profile;
      storeProfile(profile);
      state.teachers = [];
      state.disciplines = [];
      state.schedules = [];
      state.chronograms = [];
      state.lessons = [];
      state.scheduleEditing = false;
      state.chronogramDisciplineId = null;
      state.lessonWeekOffset = 0;
      state.lessonOccurrence = null;
      state.lessonChronogram = null;
      state.activeLesson = null;
      state.activeLessonContents = [];
      state.dashboardLoadedProfileId = null;
      renderProfiles();
      showToast("Novo perfil criado.");
      return profile;
    },
    onCreated: (profile) => showTeacherSetup(profile),
    onUpdate: async (id, values) => {
      const updated = await updateStudyProfile(id, values);
      state.profiles = state.profiles.map((profile) =>
        profile.id === id ? updated : profile,
      );
      if (state.currentProfile?.id === id) {
        state.currentProfile = updated;
        storeProfile(updated);
      }
      renderProfiles();
      showToast("Perfil atualizado.");
    },
    onDelete: async (profile) => {
      try {
        await deleteStudyProfile(profile.id);
        state.profiles = state.profiles.filter(
          (item) => item.id !== profile.id,
        );
        if (!state.profiles.length) {
          state.currentProfile = null;
          removeStoredProfile();
          showToast("Perfil removido.");
          return showOnboarding();
        }
        if (state.currentProfile?.id === profile.id) {
          state.currentProfile = state.profiles[0];
          state.teachers = [];
          state.disciplines = [];
          state.schedules = [];
          state.chronograms = [];
          state.lessons = [];
          state.scheduleEditing = false;
          state.chronogramDisciplineId = null;
          state.lessonWeekOffset = 0;
          state.lessonOccurrence = null;
          state.lessonChronogram = null;
          state.activeLesson = null;
          state.activeLessonContents = [];
          state.dashboardLoadedProfileId = null;
          storeProfile(state.currentProfile);
        }
        renderProfiles();
        showToast("Perfil removido.");
      } catch (error) {
        showToast(
          error.message || "Não foi possível excluir o perfil.",
          "error",
        );
      }
    },
  });
}

function showTeacherSetup(profile) {
  openTeacherSetup({
    profile,
    onCreate: async (values) => {
      const teacher = await createTeacher(state.user, profile, values);
      if (state.currentProfile?.id === profile.id)
        state.teachers = [...state.teachers, teacher];
      return teacher;
    },
    onUpdate: async (id, values) => {
      const updated = await updateTeacher(id, profile.id, values);
      if (state.currentProfile?.id === profile.id)
        state.teachers = state.teachers.map((teacher) =>
          teacher.id === id ? updated : teacher,
        );
      return updated;
    },
    onDelete: async (id) => {
      await deleteTeacher(id, profile.id);
      if (state.currentProfile?.id === profile.id) {
        const removedDisciplineIds = state.disciplines
          .filter((discipline) => discipline.professor_id === id)
          .map((discipline) => discipline.id);
        state.teachers = state.teachers.filter((teacher) => teacher.id !== id);
        state.disciplines = state.disciplines.filter(
          (discipline) => discipline.professor_id !== id,
        );
        state.schedules = state.schedules.filter(
          (schedule) => !removedDisciplineIds.includes(schedule.disciplina),
        );
        state.chronograms = state.chronograms.filter(
          (entry) => !removedDisciplineIds.includes(entry.disciplina),
        );
        state.lessons = state.lessons.filter(
          (lesson) => !removedDisciplineIds.includes(lesson.disciplina),
        );
      }
    },
    onFinish: (count) => {
      showToast(
        count
          ? "Professores cadastrados com sucesso."
          : "Você poderá cadastrar professores mais tarde.",
      );
      showDisciplineSetup(profile);
    },
  });
}

async function renderTeachers() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "teachers";
  try {
    const [teachers, disciplines] = await Promise.all([
      getTeachers(profile.id),
      getDisciplines(profile.id),
    ]);
    if (state.view !== "teachers" || state.currentProfile?.id !== profile.id)
      return;
    state.teachers = teachers;
    state.disciplines = disciplines;
    mountTeachers();
  } catch (error) {
    showToast(
      error.message || "Não foi possível carregar os professores.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountTeachers() {
  renderWithinLayout(
    teachersView({
      profile: state.currentProfile,
      teachers: state.teachers,
      disciplines: state.disciplines,
    }),
  );
  bindTeachers(root, {
    teachers: state.teachers,
    onBack: () => {
      state.view = state.returnView;
      renderCurrent();
    },
    onCreate: async (values) => {
      const teacher = await createTeacher(
        state.user,
        state.currentProfile,
        values,
      );
      state.teachers = [...state.teachers, teacher];
      mountTeachers();
      showToast("Professor adicionado com sucesso.");
      return teacher;
    },
    onUpdate: async (id, values) => {
      const updated = await updateTeacher(id, state.currentProfile.id, values);
      state.teachers = state.teachers.map((teacher) =>
        teacher.id === id ? updated : teacher,
      );
      mountTeachers();
      showToast("Professor atualizado com sucesso.");
      return updated;
    },
    onDelete: async (teacher) => {
      await deleteTeacher(teacher.id, state.currentProfile.id);
      const removedDisciplineIds = state.disciplines
        .filter((discipline) => discipline.professor_id === teacher.id)
        .map((discipline) => discipline.id);
      state.teachers = state.teachers.filter((item) => item.id !== teacher.id);
      state.disciplines = state.disciplines.filter(
        (discipline) => discipline.professor_id !== teacher.id,
      );
      state.schedules = state.schedules.filter(
        (schedule) => !removedDisciplineIds.includes(schedule.disciplina),
      );
      state.chronograms = state.chronograms.filter(
        (entry) => !removedDisciplineIds.includes(entry.disciplina),
      );
      state.lessons = state.lessons.filter(
        (lesson) => !removedDisciplineIds.includes(lesson.disciplina),
      );
      mountTeachers();
      showToast("Professor removido.");
    },
  });
}

function showDisciplineSetup(profile) {
  openDisciplineSetup({
    profile,
    teachers: state.teachers,
    onCreate: async (values) => {
      const discipline = await createDiscipline(state.user, profile, values);
      if (state.currentProfile?.id === profile.id)
        state.disciplines = [...state.disciplines, discipline];
      return discipline;
    },
    onUpdate: async (id, values) => {
      const updated = await updateDiscipline(id, profile.id, values);
      if (state.currentProfile?.id === profile.id)
        state.disciplines = state.disciplines.map((discipline) =>
          discipline.id === id ? updated : discipline,
        );
      return updated;
    },
    onDelete: async (id) => {
      await deleteDiscipline(id, profile.id);
      if (state.currentProfile?.id === profile.id) {
        state.disciplines = state.disciplines.filter(
          (discipline) => discipline.id !== id,
        );
        state.schedules = state.schedules.filter(
          (schedule) => schedule.disciplina !== id,
        );
        state.chronograms = state.chronograms.filter(
          (entry) => entry.disciplina !== id,
        );
        state.lessons = state.lessons.filter(
          (lesson) => lesson.disciplina !== id,
        );
      }
    },
    onFinish: (count) =>
      showToast(
        count
          ? "Disciplinas cadastradas com sucesso."
          : "Você poderá cadastrar disciplinas mais tarde.",
      ),
  });
}

async function renderDisciplines() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "disciplines";
  try {
    const [teachers, disciplines] = await Promise.all([
      getTeachers(profile.id),
      getDisciplines(profile.id),
    ]);
    if (state.view !== "disciplines" || state.currentProfile?.id !== profile.id)
      return;
    state.teachers = teachers;
    state.disciplines = disciplines;
    mountDisciplines();
  } catch (error) {
    showToast(
      error.message || "Não foi possível carregar as disciplinas.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountDisciplines() {
  renderWithinLayout(
    disciplinesView({
      profile: state.currentProfile,
      teachers: state.teachers,
      disciplines: state.disciplines,
    }),
  );
  bindDisciplines(root, {
    teachers: state.teachers,
    disciplines: state.disciplines,
    onBack: () => {
      state.view = state.returnView;
      renderCurrent();
    },
    onCreate: async (values) => {
      const discipline = await createDiscipline(
        state.user,
        state.currentProfile,
        values,
      );
      state.disciplines = [...state.disciplines, discipline];
      mountDisciplines();
      showToast("Disciplina adicionada com sucesso.");
      return discipline;
    },
    onUpdate: async (id, values) => {
      const updated = await updateDiscipline(
        id,
        state.currentProfile.id,
        values,
      );
      state.disciplines = state.disciplines.map((discipline) =>
        discipline.id === id ? updated : discipline,
      );
      mountDisciplines();
      showToast("Disciplina atualizada com sucesso.");
      return updated;
    },
    onDelete: async (discipline) => {
      await deleteDiscipline(discipline.id, state.currentProfile.id);
      state.disciplines = state.disciplines.filter(
        (item) => item.id !== discipline.id,
      );
      state.schedules = state.schedules.filter(
        (schedule) => schedule.disciplina !== discipline.id,
      );
      state.chronograms = state.chronograms.filter(
        (entry) => entry.disciplina !== discipline.id,
      );
      state.lessons = state.lessons.filter(
        (lesson) => lesson.disciplina !== discipline.id,
      );
      mountDisciplines();
      showToast("Disciplina removida.");
    },
  });
}

async function renderSchedules() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "schedules";
  try {
    const [teachers, disciplines, schedules] = await Promise.all([
      getTeachers(profile.id),
      getDisciplines(profile.id),
      getSchedules(profile.id),
    ]);
    if (state.view !== "schedules" || state.currentProfile?.id !== profile.id)
      return;
    state.teachers = teachers;
    state.disciplines = disciplines;
    state.schedules = schedules;
    state.dashboardLoadedProfileId = profile.id;
    mountSchedules();
  } catch (error) {
    showToast(
      error.message || "Não foi possível carregar os horários.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountSchedules() {
  renderWithinLayout(
    schedulesView({
      profile: state.currentProfile,
      disciplines: state.disciplines,
      teachers: state.teachers,
      schedules: state.schedules,
      editing: state.scheduleEditing,
    }),
  );
  bindSchedules(root, {
    disciplines: state.disciplines,
    schedules: state.schedules,
    editing: state.scheduleEditing,
    onToggleEdit: () => {
      state.scheduleEditing = !state.scheduleEditing;
      mountSchedules();
    },
    onCreate: async (values) => {
      const schedule = await createSchedule(
        state.user,
        state.currentProfile,
        values,
      );
      state.schedules = [...state.schedules, schedule];
      mountSchedules();
      showToast("Aula adicionada à grade.");
      return schedule;
    },
    onUpdate: async (id, values) => {
      const updated = await updateSchedule(id, state.currentProfile, values);
      state.schedules = state.schedules.map((schedule) =>
        schedule.id === id ? updated : schedule,
      );
      mountSchedules();
      showToast("Horário atualizado.");
      return updated;
    },
    onDelete: async (schedule) => {
      await deleteSchedule(schedule.id, state.currentProfile.id);
      state.schedules = state.schedules.filter(
        (item) => item.id !== schedule.id,
      );
      mountSchedules();
      showToast("Horário removido.");
    },
  });
}

async function renderChronogram() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "chronogram";
  try {
    const [disciplines, schedules, chronograms] = await Promise.all([
      getDisciplines(profile.id),
      getSchedules(profile.id),
      getChronogram(profile.id),
    ]);
    if (state.view !== "chronogram" || state.currentProfile?.id !== profile.id)
      return;
    state.disciplines = disciplines;
    state.schedules = schedules;
    state.chronograms = chronograms;
    state.dashboardLoadedProfileId = profile.id;
    if (
      state.chronogramDisciplineId &&
      !disciplines.some(
        (discipline) => discipline.id === state.chronogramDisciplineId,
      )
    )
      state.chronogramDisciplineId = null;
    mountChronogram();
  } catch (error) {
    showToast(
      error.message || "N\u00e3o foi poss\u00edvel carregar o cronograma.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountChronogram() {
  const selectedDiscipline =
    state.disciplines.find(
      (discipline) => discipline.id === state.chronogramDisciplineId,
    ) || null;
  const occurrences = selectedDiscipline
    ? getLessonOccurrences(
        state.currentProfile,
        selectedDiscipline.id,
        state.schedules,
      )
    : [];
  renderWithinLayout(
    chronogramView({
      profile: state.currentProfile,
      disciplines: state.disciplines,
      entries: state.chronograms,
      selectedDiscipline,
      occurrences,
    }),
  );
  bindChronogram(root, {
    profile: state.currentProfile,
    disciplines: state.disciplines,
    entries: state.chronograms,
    selectedDiscipline,
    occurrences,
    onOpenDiscipline: (id) => {
      state.chronogramDisciplineId = id;
      mountChronogram();
    },
    onBack: () => {
      state.chronogramDisciplineId = null;
      mountChronogram();
    },
    onCreate: async (values) => {
      const entry = await createChronogramEntry(
        state.user,
        state.currentProfile,
        values,
      );
      state.chronograms = [...state.chronograms, entry].sort(
        (first, second) =>
          new Date(first.data_hora) - new Date(second.data_hora),
      );
      mountChronogram();
      return entry;
    },
    onUpdate: async (id, values) => {
      const updated = await updateChronogramEntry(
        id,
        state.currentProfile,
        values,
      );
      state.chronograms = state.chronograms
        .map((entry) => (entry.id === id ? updated : entry))
        .sort(
          (first, second) =>
            new Date(first.data_hora) - new Date(second.data_hora),
        );
      mountChronogram();
      showToast("Aula atualizada.");
      return updated;
    },
    onDelete: async (entry) => {
      await deleteChronogramEntry(entry.id, state.currentProfile.id);
      state.chronograms = state.chronograms.filter(
        (item) => item.id !== entry.id,
      );
      mountChronogram();
      showToast("Aula removida do cronograma.");
    },
  });
}

async function renderLessons() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "lessons";
  try {
    const [disciplines, schedules, chronograms, lessons] = await Promise.all([
      getDisciplines(profile.id),
      getSchedules(profile.id),
      getChronogram(profile.id),
      getLessons(profile.id),
    ]);
    if (state.view !== "lessons" || state.currentProfile?.id !== profile.id)
      return;
    state.disciplines = disciplines;
    state.schedules = schedules;
    state.chronograms = chronograms;
    state.lessons = lessons;
    state.dashboardLoadedProfileId = profile.id;
    mountLessons();
  } catch (error) {
    showToast(
      error.message || "N\u00e3o foi poss\u00edvel carregar as aulas.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountLessons() {
  const weekStart = startOfWeek(new Date(), state.lessonWeekOffset);
  const occurrences = getWeekOccurrences(
    state.currentProfile,
    state.schedules,
    state.disciplines,
    weekStart,
  );
  renderWithinLayout(
    lessonsWeekView({
      weekStart,
      occurrences,
      chronograms: state.chronograms,
      lessons: state.lessons,
    }),
  );
  bindLessonsWeek(root, {
    occurrences,
    onPrevious: () => {
      state.lessonWeekOffset -= 1;
      mountLessons();
    },
    onNext: () => {
      state.lessonWeekOffset += 1;
      mountLessons();
    },
    onOpen: (occurrence) =>
      openLessonOccurrence(occurrence, "lessons").catch((error) =>
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel abrir a aula.",
          "error",
        ),
      ),
  });
}

async function openLessonOccurrence(occurrence, returnView = state.view) {
  if (!occurrence?.discipline || !state.currentProfile)
    throw new Error("Esta aula n\u00e3o est\u00e1 mais dispon\u00edvel.");
  state.returnView = returnView;
  state.lessonOccurrence = occurrence;
  const chronogram = findChronogramEntry(
    state.chronograms,
    occurrence.discipline.id,
    occurrence.startsAt,
  );
  if (chronogram?.feriado) {
    const existingHolidayLesson =
      state.lessons.find((lesson) => lesson.cronograma === chronogram.id) ||
      (await getLessonByChronogram(state.currentProfile.id, chronogram.id));
    if (existingHolidayLesson) {
      if (
        !state.lessons.some((lesson) => lesson.id === existingHolidayLesson.id)
      )
        state.lessons = [existingHolidayLesson, ...state.lessons];
      await showLessonDetail(existingHolidayLesson, occurrence);
      return;
    }
    throw new Error(
      "Esta data esta marcada como feriado. Nao e possivel registrar uma aula.",
    );
  }
  if (!chronogram) {
    state.lessonChronogram = null;
    state.view = "lesson-chronogram";
    renderLessonChronogram();
    return;
  }
  state.lessonChronogram = chronogram;
  const existing =
    state.lessons.find((lesson) => lesson.cronograma === chronogram.id) ||
    (await getLessonByChronogram(state.currentProfile.id, chronogram.id));
  if (existing) {
    if (!state.lessons.some((lesson) => lesson.id === existing.id))
      state.lessons = [existing, ...state.lessons];
    await showLessonDetail(existing, occurrence);
    return;
  }
  state.view = "lesson-form";
  renderLessonForm();
}

function lessonBack() {
  state.lessonOccurrence = null;
  state.lessonChronogram = null;
  state.activeLesson = null;
  state.activeLessonContents = [];
  state.view = state.returnView || "lessons";
  renderCurrent();
}

function renderLessonChronogram() {
  const occurrence = state.lessonOccurrence;
  if (!occurrence) return lessonBack();
  state.view = "lesson-chronogram";
  renderWithinLayout(lessonChronogramView(occurrence));
  bindLessonChronogram(root, {
    onBack: lessonBack,
    onSave: async (values) => {
      const chronogram = await createChronogramEntry(
        state.user,
        state.currentProfile,
        values,
      );
      state.chronograms = [...state.chronograms, chronogram].sort(
        (first, second) =>
          new Date(first.data_hora) - new Date(second.data_hora),
      );
      if (chronogram.feriado) {
        state.lessonOccurrence = null;
        state.lessonChronogram = null;
        state.activeLesson = null;
        state.activeLessonContents = [];
        state.returnView = "lessons";
        state.view = "lessons";
        await renderLessons();
        showToast("Feriado registrado na agenda.");
        return;
      }
      state.lessonChronogram = chronogram;
      state.view = "lesson-form";
      renderLessonForm();
      showToast("Cronograma da aula registrado.");
    },
  });
}

function renderLessonForm() {
  const occurrence = state.lessonOccurrence;
  const chronogram = state.lessonChronogram;
  if (!occurrence || !chronogram) return lessonBack();
  state.view = "lesson-form";
  renderWithinLayout(lessonFormView(occurrence, chronogram));
  bindLessonForm(root, {
    onBack: lessonBack,
    onSave: async (summary) => {
      const lesson = await createLesson(
        state.user,
        state.currentProfile,
        occurrence,
        chronogram,
        summary,
      );
      state.lessons = [
        lesson,
        ...state.lessons.filter((item) => item.id !== lesson.id),
      ];
      await showLessonDetail(lesson, occurrence);
      showToast("Aula salva com sucesso.");
    },
  });
}

async function showLessonDetail(lesson, occurrence = state.lessonOccurrence) {
  state.activeLesson = lesson;
  state.lessonOccurrence = occurrence;
  state.activeLessonContents = [];
  state.view = "lesson-detail";
  renderLessonDetail();
}

function renderLessonDetail() {
  const lesson = state.activeLesson;
  if (!lesson) return lessonBack();
  state.view = "lesson-detail";
  renderWithinLayout(
    lessonDetailView({
      lesson,
      occurrence: state.lessonOccurrence,
    }),
  );
  bindLessonDetail(root, {
    onBack: lessonBack,
    onOpenMaterials: () =>
      renderLessonMaterials().catch((error) =>
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel abrir os materiais.",
          "error",
        ),
      ),
  });
}

async function renderLessonMaterials() {
  const lesson = state.activeLesson;
  if (!lesson) return lessonBack();
  state.activeLessonContents = await getContents(lesson.id);
  state.view = "lesson-materials";
  renderWithinLayout(
    lessonMaterialsView({
      lesson,
      occurrence: state.lessonOccurrence,
      contents: state.activeLessonContents,
    }),
  );
  bindLessonMaterials(root, {
    contents: state.activeLessonContents,
    onBack: renderLessonDetail,
    onUpload: async (values) => {
      const content = await uploadContent(
        state.user,
        state.currentProfile,
        lesson,
        values,
      );
      state.activeLessonContents = [content, ...state.activeLessonContents];
      await renderLessonMaterials();
      showToast("Arquivo adicionado \u00e0 aula.");
    },
    onOpenContent: async (content) => {
      try {
        window.open(
          await getContentUrl(state.user, content),
          "_blank",
          "noopener,noreferrer",
        );
      } catch (error) {
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel abrir o arquivo.",
          "error",
        );
      }
    },
    onDownloadContent: async (content) => {
      try {
        window.open(
          await getContentUrl(state.user, content, true),
          "_blank",
          "noopener,noreferrer",
        );
      } catch (error) {
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel baixar o arquivo.",
          "error",
        );
      }
    },
    onDeleteContent: async (content) => {
      try {
        await deleteContent(state.user, content);
        state.activeLessonContents = state.activeLessonContents.filter(
          (item) => item.id !== content.id,
        );
        await renderLessonMaterials();
        showToast("Arquivo exclu\u00eddo.");
      } catch (error) {
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel excluir o arquivo.",
          "error",
        );
      }
    },
  });
}

function renderWithinLayout(content) {
  renderLayout(root, { ...state, content });
  bindLayout(root, {
    onCollapse: () => {
      state.collapsed = !state.collapsed;
      localStorage.setItem("akademo.sidebar.collapsed", state.collapsed);
      renderCurrent();
    },
    onNavigate: (view) => {
      if (view === "schedules") {
        state.returnView = state.view;
        state.scheduleEditing = false;
      }
      if (view === "chronogram") {
        state.returnView = state.view;
        state.chronogramDisciplineId = null;
      }
      if (view === "lessons") {
        state.returnView = state.view;
        state.lessonWeekOffset = 0;
        state.lessonOccurrence = null;
        state.lessonChronogram = null;
        state.activeLesson = null;
        state.activeLessonContents = [];
      }
      state.view = view;
      renderCurrent();
    },
    onPersonal: () => {
      state.returnView = state.view;
      renderPersonal();
    },
    onProfiles: () => {
      state.returnView = state.view;
      renderProfiles();
    },
    onTeachers: () => {
      state.returnView = state.view;
      renderTeachers();
    },
    onDisciplines: () => {
      state.returnView = state.view;
      renderDisciplines();
    },
    onProfileChange: (id) => {
      state.currentProfile = state.profiles.find(
        (profile) => profile.id === id,
      );
      state.teachers = [];
      state.disciplines = [];
      state.schedules = [];
      state.chronograms = [];
      state.lessons = [];
      state.scheduleEditing = false;
      state.chronogramDisciplineId = null;
      state.lessonWeekOffset = 0;
      state.lessonOccurrence = null;
      state.lessonChronogram = null;
      state.activeLesson = null;
      state.activeLessonContents = [];
      state.dashboardLoadedProfileId = null;
      storeProfile(state.currentProfile);
      renderCurrent();
      showToast("Perfil ativo alterado.");
    },
    onTheme: (event) => {
      applyTheme(event.target.checked ? "dark" : "light");
      renderCurrent();
    },
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
      localStorage.setItem(
        APP_STORAGE_KEYS.pendingAvatar,
        JSON.stringify({
          email,
          name,
          dataUrl,
          fileName: photo.name,
          type: photo.type,
        }),
      );
    } catch {
      showToast(
        "Sua conta será criada sem a foto. Você poderá adicioná-la depois em Informações.",
        "error",
      );
    }
  }
  const result = await signUp({ name, email, password });
  if (!result.session)
    showToast(
      "Conta criada. Confirme seu e-mail e depois entre para finalizar seu perfil.",
    );
}

async function handleLogout() {
  try {
    await signOut();
    renderAuthScreen();
    showToast("Você saiu da sua conta.");
  } catch (error) {
    showToast(error.message || "Não foi possível sair agora.", "error");
  }
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
      const shouldLoadAccount =
        (event === "SIGNED_IN" || event === "USER_UPDATED") &&
        session?.user &&
        state.user?.id !== session.user.id;
      if (shouldLoadAccount) hydrate(session.user);
    });
    const session = callbackSession || (await currentSession());
    if (session?.user) await hydrate(session.user);
    else renderAuthScreen();
  } catch (error) {
    console.error(error);
    renderAuthScreen();
    showToast(error.message || "Não foi possível iniciar o AKADEMO.", "error");
  }
}

boot();
