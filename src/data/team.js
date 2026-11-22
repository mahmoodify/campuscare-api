'use strict';

//Team details shown on the HTML greeting page (GET /api/v1/greeting)

module.exports = {
  projectName: 'CampusCare',
  teamName: 'Team 13',
  description:
    'CampusCare lets students report broken or missing campus inventory (for example a broken light in Building A) ' +
    'by picking an item and an issue type, without typing. Reports are routed to the right maintenance staff, ' +
    'prioritised by safety urgency, and the time to inspect and resolve each issue is tracked for administrators.',
  audience: 'Built for students, maintenance staff and university administrators.',
  members: [
    {
      name: 'Mahmud Aliyev',
      studentId: '21471',
      contribution:
        'Project setup, JSON response envelope, bearer-token authentication and role checks, ' +
        'report ownership logic, the reports list/get/create endpoints and this greeting page.',
    },
    {
      name: 'Kamal Mustafayev',
      studentId: '21115',
      contribution:
        'Mock data and in-memory store, validation rules, report update/delete and the status workflow, ' +
        'inventory and metrics endpoints, example requests and the Postman collection.',
    },
  ],
};
