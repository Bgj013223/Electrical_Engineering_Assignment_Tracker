// Assignments are temporarily stored here.
const SUPABASE_URL = 'https://afpecofwbxidnhqmtifg.supabase.co/rest/v1/';
const SUPABASE_KEY = 'sb_publishable_EIci6-B-JsUFZby6eKmgHw_cMPqeEAA';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
// Later, we will use Supabase to save them permanently.
const assignments = [];

const form = document.querySelector('#assignment-form');
const list = document.querySelector('#assignment-list');
const emptyMessage = document.querySelector('#empty-message');
const message = document.querySelector('#message');

// Run this code when the user submits the form.
form.addEventListener('submit', (event) => {
  // Stop the form from reloading the page.
  event.preventDefault();

  // Read the values entered into the form.
  const assignment = {
    course: form.elements.course.value.trim(),
    title: form.elements.title.value.trim(),
    dueDate: form.elements.dueDate.value,
    status: form.elements.status.value,
    notes: form.elements.notes.value.trim()
  };

  // Prevent a course or assignment name containing only spaces.
  if (!assignment.course || !assignment.title) {
    message.textContent =
      'Please enter a course and assignment name, not just spaces.';
    return;
  }

  assignments.push(assignment);
  renderAssignments();

  // Clear the form so another assignment can be entered.
  form.reset();
  message.textContent = 'Assignment added to this practice page.';
  form.elements.course.focus();
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
