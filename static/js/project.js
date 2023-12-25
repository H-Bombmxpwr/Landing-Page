// Shows a specific project and hides others
function showProject(projectId) {
    // Hide all projects
    var projects = document.getElementsByClassName('project-content');
    for (var i = 0; i < projects.length; i++) {
        projects[i].style.display = 'none';
    }

    // Show the selected project
    document.getElementById(projectId).style.display = 'block';
}

// Similar function for school projects
function showSchoolProject(projectId) {
    // Hide all school project contents
    var schoolProjects = document.getElementsByClassName('school-project-content');
    for (var i = 0; i < schoolProjects.length; i++) {
        schoolProjects[i].style.display = 'none';
    }

    // Show the selected school project
    document.getElementById(projectId).style.display = 'block';
}

// Event listener for DOM content loaded
document.addEventListener('DOMContentLoaded', function() {
    // Show the first personal project
    showProject('project1');

    // Show the first school project
    showSchoolProject('school-project1');
});