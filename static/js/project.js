function showProject(projectId) {
    // Hide all projects
    var projects = document.getElementsByClassName('project-content');
    for (var i = 0; i < projects.length; i++) {
        projects[i].style.display = 'none';
    }

    // Show the selected project
    document.getElementById(projectId).style.display = 'block';
    document.addEventListener('DOMContentLoaded', function() {
        showProject('project1');
    });
}