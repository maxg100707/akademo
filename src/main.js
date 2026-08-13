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
  chronogramKind,
  deleteChronogramEntry,
  findChronogramEntry,
  getChronogram,
  getLessonOccurrences,
  updateChronogramEntry,
} from "./services/chronogram.js";
import {
  createLesson,
  deleteContent,
  getProfileContents,
  getContentsByDiscipline,
  getContentUrl,
  getContents,
  getLessonByChronogram,
  getLessons,
  getWeekOccurrences,
  startOfWeek,
  uploadContent,
  uploadExamContent,
  uploadProfileContent,
  uploadPresentationContent,
  updateProfileContent,
} from "./services/lessons.js";
import {
  createTask,
  deleteTask,
  getTasks,
  setTaskCompleted,
  updateTask,
} from "./services/tasks.js";
import {
  createExam,
  createExamTopic,
  deleteExamTopic,
  getExamTopics,
  getExams,
  updateExamTopic,
} from "./services/exams.js";
import {
  createPresentation,
  getPresentations,
  updatePresentation,
} from "./services/presentations.js";
import {
  createMindMap,
  deleteMindMap,
  getMindMaps,
  updateMindMap,
} from "./services/mindmaps.js";
import {
  createVideo,
  deleteVideo,
  getVideoUrl,
  getVideos,
} from "./services/videos.js";
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
  openLessonTopicEditor,
} from "./ui/lessons-view.js";
import {
  bindLessonTasks,
  bindTasks,
  lessonTasksView,
  openTaskDetail,
  openTaskEditor,
  tasksView,
} from "./ui/tasks-view.js";
import {
  bindExamDetail,
  bindExamMaterials,
  bindExams,
  bindExamTopic,
  examDetailView,
  examMaterialsView,
  examsView,
  examTopicView,
  openExamThemeSetup,
} from "./ui/exams-view.js";
import {
  bindPresentationDetail,
  bindPresentationMaterials,
  bindPresentations,
  openPresentationEditor,
  presentationDetailView,
  presentationMaterialsView,
  presentationsView,
} from "./ui/presentations-view.js";
import { bindFiles, filesView } from "./ui/files-view.js";
import {
  bindMindMapEditor,
  bindMindMapsCatalog,
  mindMapEditorView,
  mindMapsView,
} from "./ui/mindmaps-view.js";
import {
  bindVideosCatalog,
  openVideoPlayer,
  videosView,
} from "./ui/videos-view.js";
import { showToast } from "./ui/components.js";
import {
  getStoredProfile,
  removeStoredProfile,
  storeProfile,
} from "./utils/formatters.js";
import { icon } from "./utils/icons.js";

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
  tasks: [],
  exams: [],
  examTopics: [],
  presentations: [],
  scheduleEditing: false,
  chronogramDisciplineId: null,
  lessonWeekOffset: 0,
  lessonOccurrence: null,
  lessonChronogram: null,
  activeLesson: null,
  activeLessonContents: [],
  activeExam: null,
  activeExamTopic: null,
  activeExamContents: [],
  activePresentation: null,
  activePresentationContents: [],
  mindMaps: [],
  activeMindMap: null,
  mindMapScope: null,
  videos: [],
  videoScope: null,
  profileContents: [],
  dashboardLoadedProfileId: null,
  view: "dashboard",
  returnView: "dashboard",
  taskDisciplineFilter: "",
  fileDisciplineFilter: "",
  fileSearch: "",
  basicRegistrationExpanded: localStorage.getItem("akademo.sidebar.basic-registration-expanded") === "true",
  organizationExpanded: localStorage.getItem("akademo.sidebar.organization-expanded") === "true",
  contentExpanded: localStorage.getItem("akademo.sidebar.content-expanded") === "true",
  theme: localStorage.getItem(APP_STORAGE_KEYS.theme) || "light",
};
let hydrationInProgressFor = null;
let googleAvatarSyncFor = null;

function applyTheme(theme) {
  state.theme = theme;
  document.body.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#1e2320" : "#f8faf9");
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
    state.tasks = [];
    state.exams = [];
    state.examTopics = [];
    state.presentations = [];
    state.scheduleEditing = false;
    state.chronogramDisciplineId = null;
    state.lessonWeekOffset = 0;
    state.lessonOccurrence = null;
    state.lessonChronogram = null;
    state.activeLesson = null;
    state.activeLessonContents = [];
    state.activeExam = null;
    state.activeExamTopic = null;
    state.activeExamContents = [];
    state.activePresentation = null;
    state.activePresentationContents = [];
    state.profileContents = [];
    state.taskDisciplineFilter = "";
    state.fileDisciplineFilter = "";
    state.fileSearch = "";
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
  state.tasks = [];
  state.exams = [];
  state.examTopics = [];
  state.presentations = [];
  state.scheduleEditing = false;
  state.chronogramDisciplineId = null;
  state.lessonWeekOffset = 0;
  state.lessonOccurrence = null;
  state.lessonChronogram = null;
  state.activeLesson = null;
  state.activeLessonContents = [];
  state.activeExam = null;
  state.activeExamTopic = null;
  state.activeExamContents = [];
  state.activePresentation = null;
  state.activePresentationContents = [];
  state.profileContents = [];
  state.taskDisciplineFilter = "";
  state.fileDisciplineFilter = "";
  state.fileSearch = "";
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
  if (state.view === "tasks") return renderTasks();
  if (state.view === "files") return renderFiles();
  if (state.view === "mindmaps") return renderMindMaps();
  if (state.view === "mindmap-editor") return renderMindMapEditor();
  if (state.view === "videos") return renderVideos();
  if (state.view === "exams") return renderExams();
  if (state.view === "exam-detail") return renderExamDetail();
  if (state.view === "exam-topic") return renderExamTopic();
  if (state.view === "exam-materials") return renderExamMaterials();
  if (state.view === "presentations") return renderPresentations();
  if (state.view === "presentation-detail") return renderPresentationDetail();
  if (state.view === "presentation-materials") return renderPresentationMaterials();
  if (state.view === "lessons") return renderLessons();
  if (state.view === "lesson-chronogram") return renderLessonChronogram();
  if (state.view === "lesson-form") return renderLessonForm();
  if (state.view === "lesson-detail") return renderLessonDetail();
  if (state.view === "lesson-materials") return renderLessonMaterials();
  if (state.view === "lesson-tasks") return renderLessonTasks();
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
      tasks: state.tasks,
      disciplines: state.disciplines,
      lessons: state.lessons,
      exams: state.exams,
      presentations: state.presentations,
      chronograms: state.chronograms,
      isNextClassLoading:
        state.currentProfile &&
        state.dashboardLoadedProfileId !== state.currentProfile.id,
    }),
  );
  root.querySelectorAll("[data-open-dashboard-exam]").forEach((button) =>
    button.addEventListener("click", () => {
      const exam = state.exams.find(
        (item) => item.id === button.dataset.openDashboardExam,
      );
      if (!exam) return;
      openExam(exam).catch((error) =>
        showToast(
          error.message || "Não foi possível abrir a prova.",
          "error",
        ),
      );
    }),
  );
  root.querySelectorAll("[data-open-dashboard-chronogram]").forEach((button) =>
    button.addEventListener("click", () => {
      const chronogram = state.chronograms.find(
        (item) => item.id === button.dataset.openDashboardChronogram,
      );
      if (!chronogram) return;
      openExamForChronogram(chronogram).catch((error) =>
        showToast(
          error.message || "Não foi possível abrir a prova.",
          "error",
        ),
      );
    }),
  );
  root.querySelectorAll("[data-open-dashboard-presentation]").forEach((button) =>
    button.addEventListener("click", () => {
      const presentation = state.presentations.find(
        (item) => item.id === button.dataset.openDashboardPresentation,
      );
      if (!presentation) return;
      openPresentation(presentation).catch((error) =>
        showToast(
          error.message || "Não foi possível abrir a apresentação.",
          "error",
        ),
      );
    }),
  );
  root
    .querySelectorAll("[data-open-dashboard-presentation-chronogram]")
    .forEach((button) =>
      button.addEventListener("click", () => {
        const chronogram = state.chronograms.find(
          (item) =>
            item.id === button.dataset.openDashboardPresentationChronogram,
        );
        if (!chronogram) return;
        openPresentationForChronogram(chronogram).catch((error) =>
          showToast(
            error.message || "Não foi possível abrir a apresentação.",
            "error",
          ),
        );
      }),
    );
  const taskActions = taskCallbacks(() => mountDashboard());
  root
    .querySelector("[data-add-dashboard-task]")
    ?.addEventListener("click", () =>
      openTaskEditor({
        disciplines: state.disciplines,
        lessons: state.lessons,
        ...taskActions,
      }),
    );
  root.querySelectorAll("[data-open-task]").forEach((card) => {
    const open = (event) => {
      if (event.target.closest("[data-toggle-task]")) return;
      const task = state.tasks.find((item) => item.id === card.dataset.openTask);
      if (task)
        openTaskDetail({
          task,
          disciplines: state.disciplines,
          lessons: state.lessons,
          ...taskActions,
        });
    };
    card.addEventListener("click", open);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        open(event);
      }
    });
  });
  root.querySelectorAll("[data-toggle-task]").forEach((button) =>
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      const task = state.tasks.find((item) => item.id === button.dataset.toggleTask);
      if (!task) return;
      try {
        await taskActions.onToggle(task);
      } catch (error) {
        showToast(error.message || "N\u00e3o foi poss\u00edvel atualizar a tarefa.", "error");
      }
    }),
  );
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
    const [teachers, disciplines, schedules, chronograms, lessons, tasks, exams, presentations] = await Promise.all([
      getTeachers(profile.id),
      getDisciplines(profile.id),
      getSchedules(profile.id),
      getChronogram(profile.id),
      getLessons(profile.id),
      getTasks(profile.id),
      getExams(profile.id),
      getPresentations(profile.id),
    ]);
    if (state.view !== "dashboard" || state.currentProfile?.id !== profile.id)
      return;
    state.teachers = teachers;
    state.disciplines = disciplines;
    state.schedules = schedules;
    state.chronograms = chronograms;
    state.lessons = lessons;
    state.tasks = tasks;
    state.exams = exams;
    state.presentations = presentations;
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

function replaceTask(task) {
  state.tasks = [
    task,
    ...state.tasks.filter((item) => item.id !== task.id),
  ];
}

function taskCallbacks(refresh) {
  return {
    onCreate: async (values) => {
      const task = await createTask(state.user, state.currentProfile, values);
      replaceTask(task);
      await refresh();
      showToast("Tarefa adicionada.");
      return task;
    },
    onUpdate: async (id, values) => {
      const task = await updateTask(id, state.currentProfile, values);
      replaceTask(task);
      await refresh();
      showToast("Tarefa atualizada.");
      return task;
    },
    onDelete: async (task) => {
      await deleteTask(task.id, state.currentProfile.id);
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      await refresh();
      showToast("Tarefa removida.");
    },
    onToggle: async (task) => {
      const updated = await setTaskCompleted(
        task,
        state.currentProfile.id,
        !task.completa,
      );
      replaceTask(updated);
      await refresh();
      showToast(updated.completa ? "Tarefa conclu\u00edda!" : "Tarefa reaberta.");
      return updated;
    },
  };
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
      state.tasks = [];
      state.scheduleEditing = false;
      state.chronogramDisciplineId = null;
      state.lessonWeekOffset = 0;
      state.lessonOccurrence = null;
      state.lessonChronogram = null;
      state.activeLesson = null;
      state.activeLessonContents = [];
      state.taskDisciplineFilter = "";
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
          state.tasks = [];
          state.scheduleEditing = false;
          state.chronogramDisciplineId = null;
          state.lessonWeekOffset = 0;
          state.lessonOccurrence = null;
          state.lessonChronogram = null;
          state.activeLesson = null;
          state.activeLessonContents = [];
          state.taskDisciplineFilter = "";
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
        state.tasks = state.tasks.filter(
          (task) => !removedDisciplineIds.includes(task.disciplina),
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
      state.tasks = state.tasks.filter(
        (task) => !removedDisciplineIds.includes(task.disciplina),
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
        state.tasks = state.tasks.filter((task) => task.disciplina !== id);
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
      state.tasks = state.tasks.filter(
        (task) => task.disciplina !== discipline.id,
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
      syncLinkedLessonTopic(updated);
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

async function renderTasks() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "tasks";
  try {
    const [disciplines, lessons, tasks] = await Promise.all([
      getDisciplines(profile.id),
      getLessons(profile.id),
      getTasks(profile.id),
    ]);
    if (state.view !== "tasks" || state.currentProfile?.id !== profile.id)
      return;
    state.disciplines = disciplines;
    state.lessons = lessons;
    state.tasks = tasks;
    if (
      state.taskDisciplineFilter &&
      !disciplines.some((item) => item.id === state.taskDisciplineFilter)
    )
      state.taskDisciplineFilter = "";
    mountTasks();
  } catch (error) {
    showToast(
      error.message || "N\u00e3o foi poss\u00edvel carregar as tarefas.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountTasks() {
  renderWithinLayout(
    tasksView({
      profile: state.currentProfile,
      disciplines: state.disciplines,
      lessons: state.lessons,
      tasks: state.tasks,
      filterDisciplineId: state.taskDisciplineFilter,
    }),
  );
  bindTasks(root, {
    tasks: state.tasks,
    disciplines: state.disciplines,
    lessons: state.lessons,
    onFilter: (disciplineId) => {
      state.taskDisciplineFilter = disciplineId;
      mountTasks();
    },
    ...taskCallbacks(() => mountTasks()),
  });
}

function syncLinkedLessonTopic(chronogram) {
  if (!chronogram?.aula) return;
  const withSyncedTopic = (lesson) =>
    lesson.id === chronogram.aula
      ? { ...lesson, tema: chronogram.tema }
      : lesson;
  state.lessons = state.lessons.map(withSyncedTopic);
  if (state.activeLesson?.id === chronogram.aula) {
    state.activeLesson = withSyncedTopic(state.activeLesson);
  }
}

async function renderFiles() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "files";
  try {
    const [disciplines, lessons, contents] = await Promise.all([
      getDisciplines(profile.id),
      getLessons(profile.id),
      getProfileContents(profile.id),
    ]);
    if (state.view !== "files" || state.currentProfile?.id !== profile.id)
      return;
    state.disciplines = disciplines;
    state.lessons = lessons;
    state.profileContents = contents;
    if (
      state.fileDisciplineFilter &&
      state.fileDisciplineFilter !== "__none__" &&
      !disciplines.some((item) => item.id === state.fileDisciplineFilter)
    )
      state.fileDisciplineFilter = "";
    mountFiles();
  } catch (error) {
    showToast(
      error.message || "Não foi possível carregar os arquivos do perfil.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountFiles() {
  renderWithinLayout(
    filesView({
      contents: state.profileContents,
      disciplines: state.disciplines,
      lessons: state.lessons,
      filter: state.fileDisciplineFilter,
      search: state.fileSearch,
    }),
  );
  bindFiles(root, {
    contents: state.profileContents,
    disciplines: state.disciplines,
    lessons: state.lessons,
    onFilter: (disciplineId) => {
      state.fileDisciplineFilter = disciplineId;
      mountFiles();
    },
    onSearch: (query) => {
      state.fileSearch = query;
      mountFiles();
      const search = root.querySelector("[data-files-search]");
      search?.focus();
      search?.setSelectionRange(query.length, query.length);
    },
    onUpload: async (values) => {
      const content = await uploadProfileContent(
        state.user,
        state.currentProfile,
        values,
      );
      state.profileContents = [content, ...state.profileContents];
      mountFiles();
      showToast("Arquivo adicionado ao perfil.");
      return content;
    },
    onOpen: (content) => openContent(content),
    onDownload: async (content) => {
      try {
        window.open(
          await getContentUrl(state.user, content, true),
          "_blank",
          "noopener,noreferrer",
        );
      } catch (error) {
        showToast(
          error.message || "Não foi possível baixar o arquivo.",
          "error",
        );
      }
    },
    onEdit: async (content, values) => {
      const updated = await updateProfileContent(
        content.id,
        state.user,
        state.currentProfile,
        values,
      );
      state.profileContents = state.profileContents.map((item) =>
        item.id === updated.id ? updated : item,
      );
      mountFiles();
      showToast("Arquivo atualizado.");
      return updated;
    },
    onDelete: async (content) => {
      await deleteContent(state.user, content);
      state.profileContents = state.profileContents.filter(
        (item) => item.id !== content.id,
      );
      mountFiles();
      showToast("Arquivo excluído.");
    },
  });
}

function examTopicValues(topic, contents = topic?.conteudos || []) {
  return {
    theme: topic?.tema || "",
    summary: topic?.resumo || "",
    links: Array.isArray(topic?.links) ? topic.links : [],
    contents,
  };
}

function replaceExamTopic(topic) {
  state.examTopics = [
    topic,
    ...state.examTopics.filter((item) => item.id !== topic.id),
  ];
  if (state.activeExamTopic?.id === topic.id) state.activeExamTopic = topic;
}

function examOccurrencesByDiscipline() {
  const now = new Date();
  return Object.fromEntries(
    state.disciplines.map((discipline) => [
      discipline.id,
      getLessonOccurrences(
        state.currentProfile,
        discipline.id,
        state.schedules,
      ).filter(
        (occurrence) =>
          occurrence.startsAt >= now &&
          !findChronogramEntry(
            state.chronograms,
            discipline.id,
            occurrence.startsAt,
          ),
      ),
    ]),
  );
}

async function renderExams() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "exams";
  try {
    const [disciplines, schedules, chronograms, exams] = await Promise.all([
      getDisciplines(profile.id),
      getSchedules(profile.id),
      getChronogram(profile.id),
      getExams(profile.id),
    ]);
    const scheduledProofsWithoutRecord = chronograms.filter(
      (entry) =>
        entry.prova &&
        new Date(entry.data_hora) >= new Date() &&
        !exams.some((exam) => exam.cronograma === entry.id),
    );
    const recoveredExams = await Promise.all(
      scheduledProofsWithoutRecord.map((entry) =>
        createExam(state.user, profile, {
          disciplineId: entry.disciplina,
          chronogramId: entry.id,
          title: entry.tema,
          dateTime: entry.data_hora,
        }),
      ),
    );
    const allExams = [...exams, ...recoveredExams];
    const topicGroups = await Promise.all(
      allExams.map((exam) => getExamTopics(profile.id, exam.id)),
    );
    if (state.view !== "exams" || state.currentProfile?.id !== profile.id)
      return;
    state.disciplines = disciplines;
    state.schedules = schedules;
    state.chronograms = chronograms;
    state.exams = allExams.sort(
      (first, second) => new Date(first.data) - new Date(second.data),
    );
    state.examTopics = topicGroups.flat();
    state.activeExam = null;
    state.activeExamTopic = null;
    state.activeExamContents = [];
    mountExams();
  } catch (error) {
    showToast(
      error.message || "Não foi possível carregar as provas.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountExams() {
  const occurrencesByDiscipline = examOccurrencesByDiscipline();
  renderWithinLayout(
    examsView({
      profile: state.currentProfile,
      disciplines: state.disciplines,
      exams: state.exams,
      topics: state.examTopics,
      occurrencesByDiscipline,
    }),
  );
  bindExams(root, {
    disciplines: state.disciplines,
    occurrencesByDiscipline,
    onCreate: async (values) => {
      const chronogram = await createChronogramEntry(
        state.user,
        state.currentProfile,
        {
          disciplineId: values.disciplineId,
          dateTime: values.dateTime,
          topic: values.title,
          kind: "exam",
        },
      );
      try {
        const exam = await createExam(state.user, state.currentProfile, {
          disciplineId: values.disciplineId,
          chronogramId: chronogram.id,
          title: values.title,
          dateTime: values.dateTime,
        });
        state.chronograms = [...state.chronograms, chronogram].sort(
          (first, second) =>
            new Date(first.data_hora) - new Date(second.data_hora),
        );
        state.exams = [...state.exams, exam].sort(
          (first, second) => new Date(first.data) - new Date(second.data),
        );
        showToast("Prova adicionada ao cronograma.");
        return exam;
      } catch (error) {
        await deleteChronogramEntry(chronogram.id, state.currentProfile.id);
        throw error;
      }
    },
    onCreated: (exam) =>
      openExamThemeSetupFor(exam).catch((error) =>
        showToast(
          error.message || "Não foi possível preparar os temas da prova.",
          "error",
        ),
      ),
    onOpen: (id) => {
      const exam = state.exams.find((item) => item.id === id);
      if (!exam) return;
      openExam(exam).catch((error) =>
        showToast(error.message || "Não foi possível abrir a prova.", "error"),
      );
    },
  });
}

async function openExam(exam) {
  const profileId = state.currentProfile?.id;
  state.activeExam = exam;
  state.activeExamTopic = null;
  const [topics, contents] = await Promise.all([
    getExamTopics(state.currentProfile.id, exam.id),
    getContentsByDiscipline(state.currentProfile.id, exam.disciplina),
  ]);
  if (
    state.currentProfile?.id !== profileId ||
    state.activeExam?.id !== exam.id
  )
    return;
  state.examTopics = topics;
  state.activeExamContents = contents;
  state.view = "exam-detail";
  renderExamDetail();
}

async function openExamThemeSetupFor(exam) {
  const profileId = state.currentProfile?.id;
  state.activeExam = exam;
  const [topics, contents] = await Promise.all([
    getExamTopics(state.currentProfile.id, exam.id),
    getContentsByDiscipline(state.currentProfile.id, exam.disciplina),
  ]);
  if (
    state.currentProfile?.id !== profileId ||
    state.activeExam?.id !== exam.id
  )
    return;
  state.examTopics = topics;
  state.activeExamContents = contents;
  openExamThemeSetup({
    exam,
    contents,
    initialTopics: topics,
    onCreate: async (values) => {
      const topic = await createExamTopic(
        state.user,
        state.currentProfile,
        exam,
        values,
      );
      replaceExamTopic(topic);
      return topic;
    },
    onDelete: async (topic) => {
      await deleteExamTopic(topic.id, state.currentProfile.id, exam.id);
      state.examTopics = state.examTopics.filter((item) => item.id !== topic.id);
    },
    onFinish: () => {
      state.view = "exam-detail";
      renderExamDetail();
    },
  });
}

async function openExamForChronogram(chronogram) {
  const profile = state.currentProfile;
  if (!profile || !chronogram?.prova)
    throw new Error("Esta prova não está mais disponível.");

  state.lessonOccurrence = null;
  state.lessonChronogram = null;
  state.activeLesson = null;
  state.activeLessonContents = [];
  const exams = await getExams(profile.id);
  state.exams = exams;
  const existing = exams.find((exam) => exam.cronograma === chronogram.id);
  if (existing) {
    await openExam(existing);
    return;
  }

  const exam = await createExam(state.user, profile, {
    disciplineId: chronogram.disciplina,
    chronogramId: chronogram.id,
    title: chronogram.tema,
    dateTime: chronogram.data_hora,
  });
  state.exams = [...state.exams, exam].sort(
    (first, second) => new Date(first.data) - new Date(second.data),
  );
  state.view = "exams";
  mountExams();
  await openExamThemeSetupFor(exam);
  showToast("Prova criada. Agora defina os temas de estudo.");
}

function examBack() {
  state.activeExam = null;
  state.activeExamTopic = null;
  state.activeExamContents = [];
  state.view = "exams";
  renderExams();
}

function renderExamDetail() {
  const exam = state.activeExam;
  if (!exam) return examBack();
  const discipline = state.disciplines.find(
    (item) => item.id === exam.disciplina,
  );
  state.view = "exam-detail";
  renderWithinLayout(
    examDetailView({
      exam,
      discipline,
      topics: state.examTopics,
      contents: state.activeExamContents,
    }),
  );
  bindExamDetail(root, {
    exam,
    topics: state.examTopics,
    contents: state.activeExamContents,
    onBack: examBack,
    onOpenMindMaps: () => renderMindMaps(scopeForMindMaps("exam", exam)),
    onOpenVideos: () => renderVideos(scopeForVideos("exam", exam)),
    onOpenTopic: (id) => {
      const topic = state.examTopics.find((item) => item.id === id);
      if (!topic) return;
      state.activeExamTopic = topic;
      state.view = "exam-topic";
      renderExamTopic();
    },
    onOpenMaterials: () => renderExamMaterials(),
    onCreateTopic: async (values) => {
      const topic = await createExamTopic(
        state.user,
        state.currentProfile,
        exam,
        values,
      );
      replaceExamTopic(topic);
      renderExamDetail();
      showToast("Tema adicionado à prova.");
      return topic;
    },
  });
}

function renderExamTopic() {
  const exam = state.activeExam;
  const topic = state.activeExamTopic;
  if (!exam || !topic) return renderExamDetail();
  state.view = "exam-topic";
  renderWithinLayout(
    examTopicView({
      exam,
      topic,
      contents: state.activeExamContents,
    }),
  );
  bindExamTopic(root, {
    exam,
    topic,
    contents: state.activeExamContents,
    onBack: renderExamDetail,
    onOpenMaterials: () => renderExamMaterials(),
    onOpenContent: (content) => openContent(content),
    onUpdate: async (_topic, values) => {
      const updated = await updateExamTopic(
        topic.id,
        state.user,
        state.currentProfile,
        exam,
        values,
      );
      replaceExamTopic(updated);
      renderExamTopic();
      showToast("Tema atualizado.");
      return updated;
    },
    onDelete: async (item) => {
      await deleteExamTopic(item.id, state.currentProfile.id, exam.id);
      state.examTopics = state.examTopics.filter((entry) => entry.id !== item.id);
      state.activeExamTopic = null;
      renderExamDetail();
      showToast("Tema removido da prova.");
    },
  });
}

async function openContent(content) {
  try {
    window.open(
      await getContentUrl(state.user, content),
      "_blank",
      "noopener,noreferrer",
    );
  } catch (error) {
    showToast(error.message || "Não foi possível abrir o arquivo.", "error");
  }
}

async function updateExamTopicContents(topicId, contentIds) {
  const topic = state.examTopics.find((item) => item.id === topicId);
  if (!topic || !state.activeExam) return;
  const updated = await updateExamTopic(
    topic.id,
    state.user,
    state.currentProfile,
    state.activeExam,
    examTopicValues(topic, contentIds),
  );
  replaceExamTopic(updated);
  return updated;
}

function renderExamMaterials() {
  const exam = state.activeExam;
  if (!exam) return renderExamDetail();
  const discipline = state.disciplines.find(
    (item) => item.id === exam.disciplina,
  );
  state.view = "exam-materials";
  renderWithinLayout(
    examMaterialsView({
      exam,
      discipline,
      topics: state.examTopics,
      contents: state.activeExamContents,
    }),
  );
  bindExamMaterials(root, {
    topics: state.examTopics,
    contents: state.activeExamContents,
    onBack: renderExamDetail,
    onOpenContent: (content) => openContent(content),
    onLink: async (topicId, ids) => {
      const topic = state.examTopics.find((item) => item.id === topicId);
      if (!topic) throw new Error("Tema não encontrado.");
      const contentIds = [
        ...new Set([...(Array.isArray(topic.conteudos) ? topic.conteudos : []), ...ids]),
      ];
      await updateExamTopicContents(topicId, contentIds);
      renderExamMaterials();
      showToast("Materiais vinculados ao tema.");
    },
    onUpload: async ({ topicId, title, file }) => {
      const content = await uploadExamContent(
        state.user,
        state.currentProfile,
        exam,
        { title, file },
      );
      state.activeExamContents = [content, ...state.activeExamContents];
      const topic = state.examTopics.find((item) => item.id === topicId);
      await updateExamTopicContents(topicId, [
        ...(Array.isArray(topic?.conteudos) ? topic.conteudos : []),
        content.id,
      ]);
      renderExamMaterials();
      showToast("Arquivo enviado e vinculado ao tema.");
    },
    onUnlink: async (topicId, contentId) => {
      const topic = state.examTopics.find((item) => item.id === topicId);
      if (!topic) return;
      await updateExamTopicContents(
        topicId,
        (Array.isArray(topic.conteudos) ? topic.conteudos : []).filter(
          (id) => id !== contentId,
        ),
      );
      renderExamMaterials();
      showToast("Arquivo desvinculado da prova.");
    },
  });
}

async function renderPresentations() {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "presentations";
  try {
    const [disciplines, schedules, chronograms, presentations] = await Promise.all([
      getDisciplines(profile.id),
      getSchedules(profile.id),
      getChronogram(profile.id),
      getPresentations(profile.id),
    ]);
    const scheduledWithoutRecord = chronograms.filter(
      (entry) =>
        entry.apresentacao &&
        new Date(entry.data_hora) >= new Date() &&
        !presentations.some((item) => item.cronograma === entry.id),
    );
    const recoveredPresentations = await Promise.all(
      scheduledWithoutRecord.map((entry) =>
        createPresentation(state.user, profile, {
          disciplineId: entry.disciplina,
          chronogramId: entry.id,
          title: entry.tema,
          dateTime: entry.data_hora,
        }),
      ),
    );
    if (
      state.view !== "presentations" ||
      state.currentProfile?.id !== profile.id
    )
      return;
    state.disciplines = disciplines;
    state.schedules = schedules;
    state.chronograms = chronograms;
    state.presentations = [...presentations, ...recoveredPresentations].sort(
      (first, second) => new Date(first.data) - new Date(second.data),
    );
    state.activePresentation = null;
    state.activePresentationContents = [];
    mountPresentations();
  } catch (error) {
    showToast(
      error.message || "Não foi possível carregar as apresentações.",
      "error",
    );
    state.view = state.returnView;
    renderCurrent();
  }
}

function mountPresentations() {
  const occurrencesByDiscipline = examOccurrencesByDiscipline();
  renderWithinLayout(
    presentationsView({
      profile: state.currentProfile,
      disciplines: state.disciplines,
      presentations: state.presentations,
      occurrencesByDiscipline,
    }),
  );
  bindPresentations(root, {
    disciplines: state.disciplines,
    occurrencesByDiscipline,
    onCreate: async (values) => {
      const chronogram = await createChronogramEntry(
        state.user,
        state.currentProfile,
        {
          disciplineId: values.disciplineId,
          dateTime: values.dateTime,
          topic: values.title,
          kind: "presentation",
        },
      );
      try {
        const presentation = await createPresentation(
          state.user,
          state.currentProfile,
          {
            disciplineId: values.disciplineId,
            chronogramId: chronogram.id,
            title: values.title,
            dateTime: values.dateTime,
          },
        );
        state.chronograms = [...state.chronograms, chronogram].sort(
          (first, second) =>
            new Date(first.data_hora) - new Date(second.data_hora),
        );
        state.presentations = [...state.presentations, presentation].sort(
          (first, second) => new Date(first.data) - new Date(second.data),
        );
        showToast("Apresentação adicionada ao cronograma.");
        return presentation;
      } catch (error) {
        await deleteChronogramEntry(chronogram.id, state.currentProfile.id);
        throw error;
      }
    },
    onCreated: (presentation) =>
      configurePresentation(presentation).catch((error) =>
        showToast(
          error.message || "Não foi possível configurar a apresentação.",
          "error",
        ),
      ),
    onOpen: (id) => {
      const presentation = state.presentations.find((item) => item.id === id);
      if (!presentation) return;
      openPresentation(presentation).catch((error) =>
        showToast(
          error.message || "Não foi possível abrir a apresentação.",
          "error",
        ),
      );
    },
  });
}

function replacePresentation(presentation) {
  state.presentations = [
    presentation,
    ...state.presentations.filter((item) => item.id !== presentation.id),
  ];
  if (state.activePresentation?.id === presentation.id)
    state.activePresentation = presentation;
}

async function openPresentation(presentation) {
  const profileId = state.currentProfile?.id;
  state.activePresentation = presentation;
  const contents = await getContentsByDiscipline(
    state.currentProfile.id,
    presentation.disciplina,
  );
  if (
    state.currentProfile?.id !== profileId ||
    state.activePresentation?.id !== presentation.id
  )
    return;
  state.activePresentationContents = contents;
  state.view = "presentation-detail";
  renderPresentationDetail();
}

async function configurePresentation(presentation = state.activePresentation) {
  if (!presentation || !state.currentProfile) return;
  const profileId = state.currentProfile.id;
  state.activePresentation = presentation;
  const contents = await getContentsByDiscipline(
    profileId,
    presentation.disciplina,
  );
  if (
    state.currentProfile?.id !== profileId ||
    state.activePresentation?.id !== presentation.id
  )
    return;
  state.activePresentationContents = contents;
  openPresentationEditor({
    presentation,
    contents,
    onSave: async (values) => {
      const updated = await updatePresentation(
        presentation.id,
        state.user,
        state.currentProfile,
        presentation,
        values,
      );
      replacePresentation(updated);
      showToast("Apresentação atualizada.");
      return updated;
    },
    onClose: () => {
      state.view = "presentation-detail";
      renderPresentationDetail();
    },
  });
}

async function openPresentationForChronogram(chronogram) {
  const profile = state.currentProfile;
  if (!profile || !chronogram?.apresentacao)
    throw new Error("Esta apresentação não está mais disponível.");
  state.lessonOccurrence = null;
  state.lessonChronogram = null;
  state.activeLesson = null;
  state.activeLessonContents = [];
  const presentations = await getPresentations(profile.id);
  state.presentations = presentations;
  const existing = presentations.find(
    (presentation) => presentation.cronograma === chronogram.id,
  );
  if (existing) {
    await openPresentation(existing);
    return;
  }
  const presentation = await createPresentation(state.user, profile, {
    disciplineId: chronogram.disciplina,
    chronogramId: chronogram.id,
    title: chronogram.tema,
    dateTime: chronogram.data_hora,
  });
  state.presentations = [...state.presentations, presentation].sort(
    (first, second) => new Date(first.data) - new Date(second.data),
  );
  state.view = "presentations";
  mountPresentations();
  await configurePresentation(presentation);
  showToast("Apresentação criada. Agora registre as instruções e materiais.");
}

function presentationBack() {
  state.activePresentation = null;
  state.activePresentationContents = [];
  state.view = "presentations";
  renderPresentations();
}

function renderPresentationDetail() {
  const presentation = state.activePresentation;
  if (!presentation) return presentationBack();
  const discipline = state.disciplines.find(
    (item) => item.id === presentation.disciplina,
  );
  state.view = "presentation-detail";
  renderWithinLayout(
    presentationDetailView({
      presentation,
      discipline,
      contents: state.activePresentationContents,
    }),
  );
  bindPresentationDetail(root, {
    presentation,
    contents: state.activePresentationContents,
    onBack: presentationBack,
    onOpenMaterials: () => renderPresentationMaterials(),
    onOpenMindMaps: () =>
      renderMindMaps(scopeForMindMaps("presentation", presentation)),
    onOpenVideos: () =>
      renderVideos(scopeForVideos("presentation", presentation)),
    onEdit: () =>
      configurePresentation(presentation).catch((error) =>
        showToast(
          error.message || "Não foi possível editar a apresentação.",
          "error",
        ),
      ),
    onOpenContent: (content) => openContent(content),
    onUpload: async ({ title, file }) => {
      const content = await uploadPresentationContent(
        state.user,
        state.currentProfile,
        presentation,
        { title, file },
      );
      state.activePresentationContents = [
        content,
        ...state.activePresentationContents,
      ];
      const updated = await updatePresentation(
        presentation.id,
        state.user,
        state.currentProfile,
        presentation,
        {
          instructions: presentation.instrucao || "",
          links: Array.isArray(presentation.links) ? presentation.links : [],
          contents: [
            ...new Set([
              ...(Array.isArray(presentation.conteudos)
                ? presentation.conteudos
                : []),
              content.id,
            ]),
          ],
        },
      );
      replacePresentation(updated);
      renderPresentationDetail();
      showToast("Arquivo enviado e associado à apresentação.");
    },
  });
}

function renderPresentationMaterials() {
  const presentation = state.activePresentation;
  if (!presentation) return renderPresentationDetail();
  const discipline = state.disciplines.find(
    (item) => item.id === presentation.disciplina,
  );
  state.view = "presentation-materials";
  renderWithinLayout(
    presentationMaterialsView({
      presentation,
      discipline,
      contents: state.activePresentationContents,
    }),
  );
  bindPresentationMaterials(root, {
    presentation,
    contents: state.activePresentationContents,
    onBack: renderPresentationDetail,
    onOpenContent: (content) => openContent(content),
    onUpload: async ({ title, file }) => {
      const content = await uploadPresentationContent(
        state.user,
        state.currentProfile,
        presentation,
        { title, file },
      );
      state.activePresentationContents = [
        content,
        ...state.activePresentationContents,
      ];
      const updated = await updatePresentation(
        presentation.id,
        state.user,
        state.currentProfile,
        presentation,
        {
          instructions: presentation.instrucao || "",
          links: Array.isArray(presentation.links) ? presentation.links : [],
          contents: [
            ...new Set([
              ...(Array.isArray(presentation.conteudos)
                ? presentation.conteudos
                : []),
              content.id,
            ]),
          ],
        },
      );
      replacePresentation(updated);
      renderPresentationMaterials();
      showToast("Arquivo enviado e associado à apresentação.");
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
  if (chronogram?.prova) {
    await openExamForChronogram(chronogram);
    return;
  }
  if (chronogram?.apresentacao) {
    await openPresentationForChronogram(chronogram);
    return;
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
      if (chronogram.prova) {
        await openExamForChronogram(chronogram);
        return;
      }
      if (chronogram.apresentacao) {
        await openPresentationForChronogram(chronogram);
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
  if (chronogram.prova) {
    openExamForChronogram(chronogram).catch((error) =>
      showToast(
        error.message || "Não foi possível abrir a prova.",
        "error",
      ),
    );
    return;
  }
  if (chronogram.apresentacao) {
    openPresentationForChronogram(chronogram).catch((error) =>
      showToast(
        error.message || "Não foi possível abrir a apresentação.",
        "error",
      ),
    );
    return;
  }
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
  root
    .querySelector(".lesson-tools-grid")
    ?.insertAdjacentHTML(
      "beforeend",
      `<button class="lesson-tool-card lesson-tool-card--videos" data-open-lesson-videos><span>${icon("video", 24)}</span><div><small>CONTEÚDO EM VÍDEO</small><strong>Vídeos</strong><p>Reúna explicações, gravações e revisões desta aula.</p></div><em>Abrir ${icon("arrowRight", 17)}</em></button>`,
    );
  root
    .querySelector("[data-open-lesson-videos]")
    ?.addEventListener("click", () => renderVideos(scopeForVideos("lesson", lesson)));
  bindLessonDetail(root, {
    onBack: lessonBack,
    onOpenMindMaps: () => renderMindMaps(scopeForMindMaps("lesson", lesson)),
    onOpenMaterials: () =>
      renderLessonMaterials().catch((error) =>
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel abrir os materiais.",
          "error",
        ),
      ),
    onOpenTasks: () =>
      renderLessonTasks().catch((error) =>
        showToast(
          error.message || "N\u00e3o foi poss\u00edvel abrir as tarefas.",
          "error",
        ),
      ),
    onEditTopic: () =>
      openLessonTopicEditor({
        lesson,
        onSave: async (topic) => {
          const chronogram = state.chronograms.find(
            (entry) => entry.id === lesson.cronograma,
          );
          if (!chronogram) {
            throw new Error(
              "N\u00e3o foi poss\u00edvel localizar o cronograma desta aula.",
            );
          }
          const updated = await updateChronogramEntry(
            chronogram.id,
            state.currentProfile,
            {
              disciplineId: chronogram.disciplina,
              dateTime: chronogram.data_hora,
              topic,
              kind: chronogramKind(chronogram),
            },
          );
          state.chronograms = state.chronograms.map((entry) =>
            entry.id === updated.id ? updated : entry,
          );
          syncLinkedLessonTopic(updated);
          renderLessonDetail();
          showToast("Tema atualizado no cronograma e na aula.");
        },
      }),
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

async function renderLessonTasks() {
  const lesson = state.activeLesson;
  const occurrence = state.lessonOccurrence;
  if (!lesson || !occurrence) return renderLessonDetail();
  state.tasks = await getTasks(state.currentProfile.id);
  state.view = "lesson-tasks";
  const lessonTasks = state.tasks.filter((task) => task.aula === lesson.id);
  renderWithinLayout(
    lessonTasksView({ lesson, occurrence, tasks: lessonTasks }),
  );
  bindLessonTasks(root, {
    lesson,
    occurrence,
    tasks: lessonTasks,
    onBack: renderLessonDetail,
    ...taskCallbacks(() => renderLessonTasks()),
  });
}

function mindMapReferences() {
  return {
    disciplines: state.disciplines,
    lessons: state.lessons,
    exams: state.exams,
    presentations: state.presentations,
  };
}

async function loadMindMapData() {
  const profile = state.currentProfile;
  if (!profile) return;
  const [maps, disciplines, lessons, exams, presentations] = await Promise.all([
    getMindMaps(profile.id),
    getDisciplines(profile.id),
    getLessons(profile.id),
    getExams(profile.id),
    getPresentations(profile.id),
  ]);
  if (state.currentProfile?.id !== profile.id) return;
  state.mindMaps = maps;
  state.disciplines = disciplines;
  state.lessons = lessons;
  state.exams = exams;
  state.presentations = presentations;
}

function scopeForMindMaps(type, record) {
  return {
    type,
    field: type === "lesson" ? "aula" : type === "exam" ? "prova" : "apresentacao",
    record,
    disciplineId: record.disciplina,
  };
}

function mindMapsBack() {
  const scope = state.mindMapScope;
  state.mindMapScope = null;
  state.activeMindMap = null;
  if (scope?.type === "lesson") return renderLessonDetail();
  if (scope?.type === "exam") return renderExamDetail();
  if (scope?.type === "presentation") return renderPresentationDetail();
  state.view = "dashboard";
  renderCurrent();
}

async function renderMindMaps(scope = state.mindMapScope) {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "mindmaps";
  state.mindMapScope = scope || null;
  try {
    await loadMindMapData();
    if (state.view !== "mindmaps" || state.currentProfile?.id !== profile.id) return;
    renderWithinLayout(mindMapsView({ maps: state.mindMaps, references: mindMapReferences(), scope: state.mindMapScope }));
    bindMindMapsCatalog(root, {
      maps: state.mindMaps,
      references: mindMapReferences(),
      scope: state.mindMapScope,
      onBack: mindMapsBack,
      onCreate: async (values) => {
        const map = await createMindMap(state.user, profile, values);
        state.mindMaps = [map, ...state.mindMaps];
        openMindMap(map, state.mindMapScope);
        return map;
      },
      onOpen: (map) => openMindMap(map, state.mindMapScope),
    });
  } catch (error) {
    showToast(error.message || "Não foi possível carregar os mapas mentais.", "error");
    mindMapsBack();
  }
}

function openMindMap(map, scope = state.mindMapScope) {
  state.activeMindMap = map;
  state.mindMapScope = scope || null;
  state.view = "mindmap-editor";
  renderMindMapEditor();
}

function renderMindMapEditor() {
  const map = state.activeMindMap;
  if (!map) return renderMindMaps(state.mindMapScope);
  state.view = "mindmap-editor";
  renderWithinLayout(mindMapEditorView({ map, scope: state.mindMapScope, references: mindMapReferences() }));
  bindMindMapEditor(root, {
    map,
    onBack: () => renderMindMaps(state.mindMapScope),
    onSave: async (values) => {
      const updated = await updateMindMap(map.id, state.user, state.currentProfile, map, values);
      state.activeMindMap = updated;
      state.mindMaps = state.mindMaps.map((item) => item.id === updated.id ? updated : item);
    },
    onDelete: async () => {
      try {
        await deleteMindMap(map.id, state.currentProfile.id);
        state.mindMaps = state.mindMaps.filter((item) => item.id !== map.id);
        state.activeMindMap = null;
        showToast("Mapa mental excluído.");
        renderMindMaps(state.mindMapScope);
      } catch (error) {
        showToast(error.message || "Não foi possível excluir o mapa mental.", "error");
      }
    },
  });
}

function videoReferences() {
  return {
    disciplines: state.disciplines,
    lessons: state.lessons,
    exams: state.exams,
    presentations: state.presentations,
  };
}

function scopeForVideos(type, record) {
  return {
    type,
    field:
      type === "lesson"
        ? "aula"
        : type === "exam"
          ? "prova"
          : "apresentacao",
    record,
    disciplineId: record.disciplina,
  };
}

async function loadVideoData() {
  const profile = state.currentProfile;
  if (!profile) return;
  const [videos, disciplines, lessons, exams, presentations] = await Promise.all([
    getVideos(profile.id),
    getDisciplines(profile.id),
    getLessons(profile.id),
    getExams(profile.id),
    getPresentations(profile.id),
  ]);
  if (state.currentProfile?.id !== profile.id) return;
  state.videos = videos;
  state.disciplines = disciplines;
  state.lessons = lessons;
  state.exams = exams;
  state.presentations = presentations;
}

function videosBack() {
  const scope = state.videoScope;
  state.videoScope = null;
  if (scope?.type === "lesson") return renderLessonDetail();
  if (scope?.type === "exam") return renderExamDetail();
  if (scope?.type === "presentation") return renderPresentationDetail();
  state.view = state.returnView || "dashboard";
  renderCurrent();
}

function mountVideos() {
  renderWithinLayout(
    videosView({
      videos: state.videos,
      references: videoReferences(),
      scope: state.videoScope,
    }),
  );
  bindVideosCatalog(root, {
    videos: state.videos,
    references: videoReferences(),
    scope: state.videoScope,
    onBack: videosBack,
    onCreate: async (values) => {
      const video = await createVideo(state.user, state.currentProfile, values);
      state.videos = [video, ...state.videos];
      mountVideos();
      showToast("Vídeo salvo na sua biblioteca.");
      return video;
    },
    onOpen: async (video) => {
      try {
        openVideoPlayer({
          video,
          source: await getVideoUrl(state.user, video),
          references: videoReferences(),
        });
      } catch (error) {
        showToast(error.message || "Não foi possível abrir o vídeo.", "error");
      }
    },
    onDelete: async (video) => {
      try {
        await deleteVideo(state.user, video);
        state.videos = state.videos.filter((item) => item.id !== video.id);
        mountVideos();
        showToast("Vídeo apagado.");
      } catch (error) {
        showToast(error.message || "Não foi possível apagar o vídeo.", "error");
      }
    },
  });
}

async function renderVideos(scope = state.videoScope) {
  const profile = state.currentProfile;
  if (!profile) return showOnboarding();
  state.view = "videos";
  state.videoScope = scope || null;
  try {
    await loadVideoData();
    if (state.view !== "videos" || state.currentProfile?.id !== profile.id) return;
    mountVideos();
  } catch (error) {
    showToast(error.message || "Não foi possível carregar os vídeos.", "error");
    videosBack();
  }
}

function renderWithinLayout(content) {
  renderLayout(root, { ...state, content });
  bindLayout(root, {
    onMenuGroupToggle: (group, isExpanded) => {
      const groups = {
        basic: ["basicRegistrationExpanded", "akademo.sidebar.basic-registration-expanded"],
        organization: ["organizationExpanded", "akademo.sidebar.organization-expanded"],
        content: ["contentExpanded", "akademo.sidebar.content-expanded"],
      };
      if (!groups[group]) return;
      Object.entries(groups).forEach(([key, [stateKey, storageKey]]) => {
        const value = key === group ? isExpanded : false;
        state[stateKey] = value;
        localStorage.setItem(storageKey, String(value));
      });
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
      if (view === "exams") {
        state.returnView = state.view;
        state.activeExam = null;
        state.activeExamTopic = null;
        state.activeExamContents = [];
      }
      if (view === "presentations") {
        state.returnView = state.view;
        state.activePresentation = null;
        state.activePresentationContents = [];
      }
      if (view === "files") {
        state.returnView = state.view;
        state.fileDisciplineFilter = "";
        state.fileSearch = "";
      }
      if (view === "mindmaps") {
        state.returnView = state.view;
        state.mindMapScope = null;
        state.activeMindMap = null;
      }
      if (view === "videos") {
        state.returnView = state.view;
        state.videoScope = null;
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
      state.tasks = [];
      state.exams = [];
      state.examTopics = [];
      state.presentations = [];
      state.mindMaps = [];
      state.activeMindMap = null;
      state.mindMapScope = null;
      state.videos = [];
      state.videoScope = null;
      state.scheduleEditing = false;
      state.chronogramDisciplineId = null;
      state.lessonWeekOffset = 0;
      state.lessonOccurrence = null;
      state.lessonChronogram = null;
      state.activeLesson = null;
      state.activeLessonContents = [];
      state.activeExam = null;
      state.activeExamTopic = null;
      state.activeExamContents = [];
      state.activePresentation = null;
      state.activePresentationContents = [];
      state.profileContents = [];
      state.taskDisciplineFilter = "";
      state.fileDisciplineFilter = "";
      state.fileSearch = "";
      state.dashboardLoadedProfileId = null;
      storeProfile(state.currentProfile);
      renderCurrent();
      showToast("Perfil ativo alterado.");
    },
    onTheme: (event) => {
      applyTheme(event.target.checked ? "dark" : "light");
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
