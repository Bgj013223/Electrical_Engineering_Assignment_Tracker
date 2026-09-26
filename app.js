// Connect to Supabase.
const SUPABASE_URL = 'https://afpecofwbxidnhqmtifg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_EIci6-B-JsUFZby6eKmgHw_cMPqeEAA';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// Keep a list of assignments currently displayed on the page.
const assignments = [];

// Find the assignment form and list.
const form = document.querySelector('#assignment-form');
const list = document.querySelector('#assignment-list');
const emptyMessage = document.querySelector('#empty-message');
const message = document.querySelector('#message');

// Find the account form and its controls.
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

// Save an assignment when the form is submitted.
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!currentUser) {
    message.textContent = 'Please log in before adding an assignment.';
    return;
  }

  if (savingAssignment) return;

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

  const submitButton = form.querySelector('button[type="submit"]');
  savingAssignment = true;
  submitButton.disabled = true;
  message.textContent = 'Saving assignment...';

  try {
    // Save the assignment and retrieve the saved row.
    const { data, error } = await supabaseClient
      .from('assignments')
      .insert(assignment)
      .select()
      .single();

    if (error) throw error;

    // Only display the result if the same user is still logged in.
    if (currentUser?.id !== assignment.user_id) return;

    assignments.push({
      ...data,
      dueDate: data.due_date
    });

    renderAssignments();
    form.reset();
    message.textContent = 'Assignment saved to the database.';
    form.elements.course.focus();
  } catch (error) {
    if (currentUser?.id === assignment.user_id) {
      message.textContent =
        error.message || 'Could not save the assignment. Please try again.';
    }
  } finally {
    savingAssignment = false;
    submitButton.disabled = false;
  }
});

// Display the assignments on the page.
function renderAssignments() {
  list.replaceChildren();
  emptyMessage.hidden = assignments.length > 0;

  for (const assignment of assignments) {
    const item = document.createElement('li');
    item.className = 'assignment';

    const heading = document.createElement('h3');
    heading.textContent = assignment.title;

    const details = document.createElement('p');
    details.textContent =
      `${assignment.course} • Due: ${assignment.dueDate} • ${assignment.status}`;

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

// Connect the account buttons to their actions.
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

// Update the page when someone logs in or out.
supabaseClient.auth.onAuthStateChange((event, session) => {
  const nextUser = session?.user ?? null;

  // Clear the displayed list when the account changes.
  // This does not delete assignments from the database.
  if (currentUser?.id !== nextUser?.id) {
    assignments.length = 0;
    renderAssignments();
    form.reset();
    message.textContent = '';
  }

  currentUser = nextUser;
  authForm.hidden = Boolean(currentUser);
  accountInfo.hidden = !currentUser;
  userEmail.textContent = currentUser?.email ?? '';
});
