// Shows a specific project, hides others, and updates the tab's style
function showProject(projectId) {
    // Retrieve all project tabs and project contents
    var tabs = document.querySelectorAll('#projects .tab');
    var projects = document.querySelectorAll('#projects .project-content');
    
    // Hide all projects and remove the active class from all tabs
    for (var i = 0; i < projects.length; i++) {
        projects[i].style.display = 'none';
        tabs[i].classList.remove('tab-active');
    }

    // Show the selected project and add active class to the selected tab
    var activeTab = document.querySelector(`#projects .tab[onclick="showProject('${projectId}')"]`);
    document.getElementById(projectId).style.display = 'block';
    activeTab.classList.add('tab-active');
}

// Shows a specific school project, hides others, and updates the tab's style
function showSchoolProject(projectId) {
    // Retrieve all school project tabs and project contents
    var schoolTabs = document.querySelectorAll('#school-projects .tab');
    var schoolProjects = document.querySelectorAll('#school-projects .school-project-content');
    
    // Hide all school projects and remove the active class from all school tabs
    for (var i = 0; i < schoolProjects.length; i++) {
        schoolProjects[i].style.display = 'none';
        schoolTabs[i].classList.remove('tab-active');
    }

    // Show the selected school project and add active class to the selected tab
    var activeSchoolTab = document.querySelector(`#school-projects .tab[onclick="showSchoolProject('${projectId}')"]`);
    document.getElementById(projectId).style.display = 'block';
    activeSchoolTab.classList.add('tab-active');
}

// Event listener for DOM content loaded to set the initial active tab
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the first tab of personal projects as active
    var firstProjectTab = document.querySelector('#projects .tab');
    var firstProjectId = firstProjectTab.getAttribute('onclick').split('\'')[1];
    showProject(firstProjectId);
    
    // Initialize the first tab of academic projects as active
    var firstSchoolProjectTab = document.querySelector('#school-projects .tab');
    var firstSchoolProjectId = firstSchoolProjectTab.getAttribute('onclick').split('\'')[1];
    showSchoolProject(firstSchoolProjectId);
});
