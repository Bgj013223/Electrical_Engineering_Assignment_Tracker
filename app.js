// Connect to Supabase.
const SUPABASE_URL = 'https://afpecofwbxidnhqmtifg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EIci6-B-JsUFZby6eKmgHw_cMPqeEAA';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Assignments currently displayed on the page.
const assignments = [];

// Assignment controls.
const form = document.querySelector('#assignment-form');
const list = document.querySelector('#assignment-list');
const emptyMessage = document.querySelector('#empty-message');
const message = document.querySelector('#message');
const submitButton = form.querySelector('button[type="submit"]');

// Account controls.
const authForm = document.querySelector('#auth-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const signupButton = document.querySelector('#signup-button');
const logoutButton = document.querySelector('#logout-button');
const accountInfo = document.querySelector('#account-info');
const userEmail = document.querySelector('#user-email');
const authMessage = document.querySelector('#auth-message');

let currentUser = null;
let authBusy = false;
let savingAssignment = false;
let loadingAssignments = false;
let loadRequest = 0;

// Replace the old practice-version notice.
document.querySelector('.notice').textContent =
  'Log in to save and view your assignments. Saved assignments stay available after refreshing.';

// Enable adding only when the app is ready.
function updateSubmitButton() {
  submitButton.disabled =
    !currentUser || savingAssignment || loadingAssignments;
}

updateSubmitButton();

// Display assignments on the page.
function renderAssignments() {
  list.replaceChildren();
  emptyMessage.hidden = assignments.length > 0;

  if (!currentUser) {
    emptyMessage.textContent = 'Log in to see your assignments.';
  } else if (loadingAssignments) {
    emptyMessage.textContent = 'Loading assignments...';
  } else {
    emptyMessage.textContent = 'No assignments yet. Add your first one above.';
  }

  for (const assignment of assignments) {
    const item = document.createElement('li');
    item.className = 'assignment';

    const heading = document.createElement('h3');
    heading.textContent = assignment.title;

    const details = document.createElement('p');
    details.textContent =
      `${assignment.course} • Due: ${assignment.due_date} • ${assignment.status}`;

    item.append(heading, details);

    if (assignment.notes) {
      const notes = document.createElement('p');
      notes.className = 'notes';
      notes.textContent = assignment.notes;
      item.append(notes);
    }

    list.append(item);
  }
}

// Retrieve the logged-in user's assignments.
async function loadAssignments() {
  if (!currentUser) return false;

  const userId = currentUser.id;
  const requestId = ++loadRequest;
  loadingAssignments = true;
  updateSubmitButton();
  renderAssignments();
  message.textContent = 'Loading assignments...';

  try {
    const { data, error } = await supabaseClient
      .from('assignments')
      .select('*')
      .eq('user_id', userId)
      .order('due_date', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;

    // Ignore results from an older request or a different account.
    if (
      requestId !== loadRequest ||
      currentUser?.id !== userId
    ) {
      return false;
    }

    assignments.length = 0;
    assignments.push(...data);
    message.textContent = '';
    return true;
  } catch (error) {
    if (
      requestId === loadRequest &&
      currentUser?.id === userId
    ) {
      message.textContent =
        `Could not load assignments: ${error.message || 'Please refresh to try again.'}`;
    }

    return false;
  } finally {
    if (requestId === loadRequest) {
      loadingAssignments = false;
      updateSubmitButton();
      renderAssignments();
    }
  }
}

// Save an assignment when the form is submitted.
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser) {
    message.textContent = 'Please log in before adding an assignment.';
    return;
  }

  if (savingAssignment || loadingAssignments) return;

  const assignment = {
    course: form.elements.course.value.trim(),
    title: form.elements.title.value.trim(),
    due_date: form.elements.dueDate.value,
    status: form.elements.status.value,
    notes: form.elements.notes.value.trim(),
    user_id: currentUser.id
  };

  if (!assignment.course || !assignment.title) {
    message.textContent =
      'Please enter a course and assignment name, not just spaces.';
    return;
  }

  savingAssignment = true;
  updateSubmitButton();
  message.textContent = 'Saving assignment...';

  try {
    const { error } = await supabaseClient
      .from('assignments')
      .insert(assignment);

    if (error) throw error;

    if (currentUser?.id !== assignment.user_id) return;

    form.reset();

    // Reload the list so it includes the saved assignment.
    const loaded = await loadAssignments();

    if (currentUser?.id !== assignment.user_id) return;

    message.textContent = loaded
      ? 'Assignment saved to the database.'
      : 'Assignment saved, but the list could not reload. Refresh to try loading it again.';

    form.elements.course.focus();
  } catch (error) {
    if (currentUser?.id === assignment.user_id) {
      message.textContent =
        error.message || 'Could not save the assignment. Please try again.';
    }
  } finally {
    savingAssignment = false;
    updateSubmitButton();
  }
});

// Handle registration, login, and logout.
async function handleAuth(action) {
  if (authBusy) return;

  if (action !== 'logout' && !authForm.reportValidity()) {
    return;
  }

  authBusy = true;
  authMessage.textContent = 'Please wait...';

  try {
    const credentials = {
      email: emailInput.value.trim(),
      password: passwordInput.value
    };

    if (action === 'signup') {
      const { data, error } =
        await supabaseClient.auth.signUp(credentials);

      if (error) throw error;

      authMessage.textContent = data.session
        ? 'You are now logged in.'
        : 'Check your email for a confirmation link before logging in.';
    } else if (action === 'login') {
      const { error } =
        await supabaseClient.auth.signInWithPassword(credentials);

      if (error) throw error;

      authMessage.textContent = 'You are now logged in.';
    } else {
      const { error } =
        await supabaseClient.auth.signOut({ scope: 'local' });

      if (error) throw error;

      authMessage.textContent = 'You are now logged out.';
    }

    passwordInput.value = '';
  } catch (error) {
    authMessage.textContent = error.message || 'Please try again.';
  } finally {
    authBusy = false;
  }
}

// Connect the account buttons.
authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  handleAuth('login');
});

signupButton.addEventListener('click', () => {
  handleAuth('signup');
});

logoutButton.addEventListener('click', () => {
  handleAuth('logout');
});

// Respond to login, logout, and the session restored after refresh.
supabaseClient.auth.onAuthStateChange((event, session) => {
  const nextUser = session?.user ?? null;
  const accountChanged = currentUser?.id !== nextUser?.id;

  currentUser = nextUser;
  authForm.hidden = Boolean(currentUser);
  accountInfo.hidden = !currentUser;
  userEmail.textContent = currentUser?.email ?? '';

  if (accountChanged) {
    // Discard results from requests for the previous account.
    loadRequest++;
    assignments.length = 0;
    form.reset();
    message.textContent = '';
    loadingAssignments = Boolean(currentUser);

    if (currentUser) {
      const userId = currentUser.id;

      // Fetch after Supabase finishes processing the login event.
      setTimeout(() => {
        if (currentUser?.id === userId) {
          loadAssignments();
        }
      }, 0);
    }
  }

  updateSubmitButton();
  renderAssignments();
});
