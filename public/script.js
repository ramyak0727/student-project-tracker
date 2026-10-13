
const form = document.querySelector('#project-form');
const nameInput = document.querySelector('#name');
const statusInput = document.querySelector('#status');
const projectList = document.querySelector('#project-list');
const emptyState = document.querySelector('#empty-state');
const saveButton = document.querySelector('#save-button');
const cancelButton = document.querySelector('#cancel-button');
const message = document.querySelector('#message');

const STORAGE_KEY = 'workshop-projects-v1';

// Projects are loaded from localStorage when the page starts.
let projects = [];
let editingId = null;

// If stored data cannot be trusted, don't overwrite it automatically.
let storageReady = true;

// Display a message without interpreting it as HTML.
function showMessage(text) {
  if (message) {
    message.textContent = text;
  }
}

// Generate a unique ID for each new project.
function generateProjectId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Check that stored data is an array of valid project records.
function isValidProjectArray(data) {
  if (!Array.isArray(data)) {
    return false;
  }

  const ids = new Set();

  return data.every(project => {
    if (
      project === null ||
      typeof project !== 'object' ||
      Array.isArray(project) ||
      typeof project.id !== 'string' ||
      project.id.trim() === '' ||
      typeof project.name !== 'string' ||
      project.name.trim() === '' ||
      typeof project.status !== 'string' ||
      project.status.trim() === '' ||
      ids.has(project.id)
    ) {
      return false;
    }

    ids.add(project.id);
    return true;
  });
}

// Load and validate projects when the page starts.
function loadProjects() {
  let storedText;

  try {
    storedText = window.localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    storageReady = false;
    showMessage(
      'Could not read browser storage. Changes cannot be saved.'
    );
    return;
  }

  // A missing key means this is a new, empty tracker.
  if (storedText === null) {
    projects = [];
    return;
  }

  try {
    // JSON.parse turns stored text back into JavaScript data.
    const storedProjects = JSON.parse(storedText);

    if (!isValidProjectArray(storedProjects)) {
      storageReady = false;
      showMessage(
        'Stored project data is invalid. It has not been overwritten. ' +
        'Your changes cannot be saved until the stored data is repaired.'
      );
      return;
    }

    projects = storedProjects;
  } catch (error) {
    storageReady = false;
    showMessage(
      'Stored project data could not be read. It has not been overwritten. ' +
      'Your changes cannot be saved until the stored data is repaired.'
    );
  }
}

// Save the current collection to localStorage.
function saveProjects() {
  if (!storageReady) {
    showMessage(
      'Changes could not be saved because browser storage data ' +
      'is unavailable or invalid.'
    );
    return false;
  }

  try {
    // JSON.stringify turns our collection into storable text.
    const storedText = JSON.stringify(projects);
    window.localStorage.setItem(STORAGE_KEY, storedText);
    showMessage('');
    return true;
  } catch (error) {
    showMessage(
      'Changes could not be saved to browser storage. ' +
      'Your current changes may be lost if you refresh.'
    );
    return false;
  }
}

// Return the form to Add mode.
function resetFormMode() {
  editingId = null;
  form.reset();

  saveButton.textContent = 'Save Project';
  cancelButton.hidden = true;
}

// Display all projects and their action buttons.
function renderProjects() {
  projectList.replaceChildren();

  projects.forEach(project => {
    const listItem = document.createElement('li');

    const projectName = document.createElement('strong');
    projectName.textContent = project.name;

    const projectStatus = document.createElement('p');
    projectStatus.textContent = `Status: ${project.status}`;

    // Edit button
    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Edit';

    editButton.addEventListener('click', () => {
      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) {
        return;
      }

      editingId = selectedProject.id;

      nameInput.value = selectedProject.name;
      statusInput.value = selectedProject.status;

      saveButton.textContent = 'Save changes';
      cancelButton.hidden = false;

      showMessage('');
      nameInput.focus();
    });

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.textContent = 'Delete';

    deleteButton.addEventListener('click', () => {
      const selectedProject = projects.find(
        item => item.id === project.id
      );

      if (!selectedProject) {
        return;
      }

      const confirmed = window.confirm(
        `Delete project "${selectedProject.name}"?`
      );

      // Cancel makes no changes to the collection or storage.
      if (!confirmed) {
        return;
      }

      const projectIndex = projects.findIndex(
        item => item.id === selectedProject.id
      );

      if (projectIndex === -1) {
        return;
      }

      // Keep a copy so we can restore memory if saving fails.
      const removedProject = projects[projectIndex];
      projects.splice(projectIndex, 1);

      if (editingId === selectedProject.id) {
        resetFormMode();
      }

      renderProjects();

      if (!saveProjects()) {
        // Restore the in-memory record if persistence failed.
        projects.splice(projectIndex, 0, removedProject);
        renderProjects();
      }
    });

    listItem.appendChild(projectName);
    listItem.appendChild(projectStatus);
    listItem.appendChild(editButton);
    listItem.appendChild(deleteButton);

    projectList.appendChild(listItem);
  });

  if (emptyState) {
    emptyState.hidden = projects.length > 0;
  }
}

// Handle both Add and Edit with one submit listener.
form.addEventListener('submit', event => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const status = statusInput.value;

  if (!name) {
    showMessage('Please enter a project name.');
    nameInput.focus();
    return;
  }

  if (editingId !== null) {
    const selectedProject = projects.find(
      project => project.id === editingId
    );

    if (!selectedProject) {
      resetFormMode();
      renderProjects();
      showMessage('The project being edited could not be found.');
      return;
    }

    // Keep the original project so we can undo a failed save.
    const previousName = selectedProject.name;
    const previousStatus = selectedProject.status;

    selectedProject.name = name;
    selectedProject.status = status;

    if (!saveProjects()) {
      selectedProject.name = previousName;
      selectedProject.status = previousStatus;
      renderProjects();
      return;
    }
  } else {
    const newProject = {
      id: generateProjectId(),
      name: name,
      status: status
    };

    projects.push(newProject);

    if (!saveProjects()) {
      projects.pop();
      renderProjects();
      return;
    }
  }

  resetFormMode();
  renderProjects();
});

// Cancel Edit without changing stored records.
cancelButton.addEventListener('click', () => {
  resetFormMode();
  showMessage('');
});

// Load saved records, then display the initial list.
loadProjects();
renderProjects();
