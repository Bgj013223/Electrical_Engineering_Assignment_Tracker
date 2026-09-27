// The publishable key is used in the browser.
// RLS policies protect each user's assignments.
const SUPABASE_URL = 'https://afpecofwbxidnhqmtifg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EIci6-B-JsUFZby6eKmgHw_cMPqeEAA';

// Find the page controls.
const form = document.querySelector('#assignment-form');
const fields = document.querySelector('#assignment-fields');
const list = document.querySelector('#assignment-list');
const emptyMessage = document.querySelector('#empty-message');
const message = document.querySelector('#message');
const formHeading = document.querySelector('#form-heading');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const reloadButton = document.querySelector('#reload-button');

const authForm = document.querySelector('#auth-form');
const emailInput = document.querySelector('#email');
const passwordInput = document.querySelector('#password');
const signupButton = document.querySelector('#signup-button');
const logoutButton = document.querySelector('#logout-button');
const accountInfo = document.querySelector('#account-info');
const userEmail = document.querySelector('#user-email');
const authMessage = document.querySelector('#auth-message');

let db;
let currentUser = null;
let assignments = [];
let editingId = null;
let busy = false;
let authBusy = false;
let loaded = false;
let accountVersion = 0;

// Disable controls during requests to prevent duplicate changes.
function updateControls() {
  fields.disabled = !currentUser || busy || authBusy;
  reloadButton.disabled = !currentUser || busy || authBusy;

  authForm.querySelectorAll('button, input').forEach((control) => {
    control.disabled = authBusy;
  });

  logoutButton.disabled = authBusy || busy;

  list.querySelectorAll('button').forEach((button) => {
    button.disabled = busy || authBusy;
  });
}

// Return the form to adding a new assignment.
function cancelEdit() {
  editingId = null;
  form.reset();
  formHeading.textContent = 'Add an assignment';
  saveButton.textContent = 'Add assignment';
  cancelButton.hidden = true;
}

// Display assignments and their Edit and Delete buttons.
function renderAssignments() {
  list.replaceChildren();
  emptyMessage.hidden = assignments.length > 0;

  emptyMessage.textContent = !currentUser
    ? 'Log in to see your assignments.'
    : !loaded
      ? 'Your list has not loaded yet. Use Reload list to try again.'
      : 'No assignments yet. Add your first one above.';

  for (const assignment of assignments) {
    const item = document.createElement('li');
    item.className = 'assignment';

    const heading = document.createElement('h3');
    heading.textContent = assignment.title;

    const details = document.createElement('p');
    details.textContent =
      `${assignment.course} • Due: ${assignment.due_date}`;

    const status = document.createElement('span');
    status.className = assignment.status === 'Completed'
      ? 'badge completed'
      : 'badge';
    status.textContent = assignment.status;

    item.append(heading, details, status);

    if (assignment.notes) {
      const notes = document.createElement('p');
      notes.className = 'notes';

      // Display user input as text instead of interpreting it as HTML.
      notes.textContent = assignment.notes;
      item.append(notes);
    }

    const actions = document.createElement('div');
    actions.className = 'actions';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'secondary';
    edit.textContent = 'Edit';
    edit.setAttribute('aria-label', `Edit ${assignment.title}`);
    edit.addEventListener('click', () => startEdit(assignment));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Delete';
    remove.setAttribute('aria-label', `Delete ${assignment.title}`);
    remove.addEventListener('click', () => deleteAssignment(assignment));

    actions.append(edit, remove);
    item.append(actions);
    list.append(item);
  }

  updateControls();
}

// Retrieve the user's assignments from Supabase.
// RLS also checks ownership in the database.
async function fetchAssignments(userId, version) {
  const { data, error } = await db
    .from('assignments')
    .select('*')
    .eq('user_id', userId)
    .order('due_date', { ascending: true })
    .order('id', { ascending: true });

  if (error) throw error;

  // Ignore results if the account changed during the request.
  if (version !== accountVersion) return false;

  assignments = data;
  loaded = true;
  renderAssignments();
  return true;
}

async function loadAssignments() {
  if (!currentUser || busy) return;

  const version = accountVersion;
  const userId = currentUser.id;

  busy = true;
  updateControls();
  message.textContent = 'Loading assignments...';

  try {
    if (await fetchAssignments(userId, version)) {
      message.textContent = '';
    }
  } catch (error) {
    if (version === accountVersion) {
      message.textContent =
        `Could not load assignments: ${error.message}`;
    }
  } finally {
    if (version === accountVersion) {
      busy = false;
      renderAssignments();
    }
  }
}

// Copy the selected assignment into the form.
function startEdit(assignment) {
  if (!currentUser || busy || authBusy) return;

  editingId = assignment.id;
  form.elements.course.value = assignment.course;
  form.elements.title.value = assignment.title;
  form.elements.dueDate.value = assignment.due_date;
  form.elements.status.value = assignment.status;
  form.elements.notes.value = assignment.notes || '';

  formHeading.textContent = 'Edit assignment';
  saveButton.textContent = 'Save changes';
  cancelButton.hidden = false;
  message.textContent =
    'Update the fields or status, then click Save changes.';

  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.course.focus({ preventScroll: true });
}

// Create or update an assignment.
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser || busy || authBusy) return;

  const row = {
    course: form.elements.course.value.trim(),
    title: form.elements.title.value.trim(),
    due_date: form.elements.dueDate.value,
    status: form.elements.status.value,
    notes: form.elements.notes.value.trim()
  };

  if (!row.course || !row.title) {
    message.textContent =
      'Enter a course and assignment name, not just spaces.';
    return;
  }

  const userId = currentUser.id;
  const version = accountVersion;
  const isEditing = editingId !== null;

  busy = true;
  updateControls();
  message.textContent = 'Saving assignment...';

  try {
    const query = isEditing
      ? db.from('assignments')
          .update(row)
          .eq('id', editingId)
          .eq('user_id', userId)
      : db.from('assignments')
          .insert({ ...row, user_id: userId });

    const { error } = await query.select('id').single();

    if (error) throw error;
    if (version !== accountVersion) return;

    cancelEdit();

    try {
      await fetchAssignments(userId, version);

      if (version === accountVersion) {
        message.textContent = isEditing
          ? 'Assignment updated.'
          : 'Assignment saved to the database.';
      }
    } catch (error) {
      if (version === accountVersion) {
        message.textContent =
          'Saved successfully, but the list could not reload. Click Reload list.';
      }
    }
  } catch (error) {
    if (version === accountVersion) {
      message.textContent = `Could not save: ${error.message}`;
    }
  } finally {
    if (version === accountVersion) {
      busy = false;
      updateControls();
    }
  }
});

// Delete only the selected assignment.
async function deleteAssignment(assignment) {
  if (!currentUser || busy || authBusy) return;

  const confirmed = window.confirm(
    `Delete "${assignment.title}"? This cannot be undone.`
  );

  if (!confirmed) return;

  const version = accountVersion;
  const userId = currentUser.id;

  busy = true;
  updateControls();
  message.textContent = 'Deleting assignment...';

  try {
    const { error } = await db
      .from('assignments')
      .delete()
      .eq('id', assignment.id)
      .eq('user_id', userId)
      .select('id')
      .single();

    if (error) throw error;
    if (version !== accountVersion) return;

    assignments = assignments.filter(
      (row) => row.id !== assignment.id
    );

    if (editingId === assignment.id) {
      cancelEdit();
    }

    renderAssignments();
    message.textContent = 'Assignment deleted.';
  } catch (error) {
    if (version === accountVersion) {
      message.textContent = `Could not delete: ${error.message}`;
    }
  } finally {
    if (version === accountVersion) {
      busy = false;
      updateControls();
      reloadButton.focus();
    }
  }
}

cancelButton.addEventListener('click', () => {
  cancelEdit();
  message.textContent = 'Edit cancelled. No changes saved.';
});

reloadButton.addEventListener('click', loadAssignments);

// Handle registration, login, and logout.
async function handleAuth(action) {
  if (!db || authBusy || busy) return;

  if (action !== 'logout' && !authForm.reportValidity()) {
    return;
  }

  authBusy = true;
  updateControls();
  authMessage.textContent = 'Please wait...';

  try {
    const credentials = {
      email: emailInput.value.trim(),
      password: passwordInput.value
    };

    if (action === 'signup') {
      const { data, error } = await db.auth.signUp(credentials);

      if (error) throw error;

      authMessage.textContent = data.session
        ? 'You are now logged in.'
        : 'Check your email for a confirmation link, then return here to log in.';
    } else if (action === 'login') {
      const { error } =
        await db.auth.signInWithPassword(credentials);

      if (error) throw error;

      authMessage.textContent = 'You are now logged in.';
    } else {
      const { error } =
        await db.auth.signOut({ scope: 'local' });

      if (error) throw error;

      authMessage.textContent = 'You are now logged out.';
    }

    passwordInput.value = '';
  } catch (error) {
    authMessage.textContent = error.message || 'Please try again.';
  } finally {
    authBusy = false;
    updateControls();
  }
}

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

// Restore login after refresh and respond to account changes.
try {
  db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  db.auth.onAuthStateChange((event, session) => {
    const nextUser = session?.user ?? null;
    const changed = currentUser?.id !== nextUser?.id;

    currentUser = nextUser;
    authForm.hidden = Boolean(currentUser);
    accountInfo.hidden = !currentUser;
    userEmail.textContent = currentUser?.email ?? '';

    if (changed || event === 'INITIAL_SESSION') {
      const version = ++accountVersion;

      assignments = [];
      loaded = false;
      busy = Boolean(currentUser);
      cancelEdit();

      message.textContent = currentUser
        ? 'Loading assignments...'
        : '';

      // Start database requests after the auth callback finishes.
      if (currentUser) {
        setTimeout(() => {
          if (version === accountVersion) {
            busy = false;
            loadAssignments();
          }
        }, 0);
      }
    }

    renderAssignments();
  });
} catch (error) {
  authMessage.textContent =
    'Could not load Supabase. Check your internet connection and refresh the page.';

  authForm.querySelectorAll('button').forEach((button) => {
    button.disabled = true;
  });
}
