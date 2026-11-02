// English copy for project descriptions. The API stores them in Spanish, so
// they are overridden here by project id; a project missing from this map
// falls back to the API text.

export const projectDescriptions: Record<string, string> = {
  // I_AM_POOR
  '6a456366206993db1ec040ad':
    'Personal finance bot that logs expenses and monthly payments over Telegram, using AI to interpret messages and Supabase/PostgreSQL for storage.',
  // Cultura Café
  '6a456399206993db1ec040b0':
    'An educational landing page about coffee culture covering where the beans come from, varieties, brewing methods and popular recipes to make coffee at home. The content is organised into sections that teach both theory and practice for coffee lovers.',
  // Beauty Nails
  '6a456314206993db1ec040aa':
    'Static one-page frontend for a nail salon or manicure service. Includes sections presenting the services, a style gallery, contact details and a call to action to book appointments. Built with HTML, CSS and JavaScript for an attractive, responsive visual experience.',
  // Dark Kanban Manager
  '6a4561fc206993db1ec040a4':
    'Web app for managing tasks on a Kanban board with "To do", "In progress" and "Done" columns. You can create tasks with a title, due date, complexity and priority, and add subtasks as checklists. Deployed as a static page on GitHub Pages.',
  // Send Poems API
  '6a4560ba206993db1ec040a1':
    'Backend API built to send poems by email to specific recipients. It exposes endpoints that receive the poem content and handle email delivery, with secure configuration through environment variables. A server-logic project, ideal for integrating with frontend apps or automations. It has no graphical interface.',
  // PetQuest
  '6a4562be206993db1ec040a7':
    'PetQuest is a web platform built as a collaborative (unofficial) internship project with Foo Talent Group. The goal was to apply frontend and backend skills as a team by creating a way to post and search for lost, found or adoptable pets. It includes pet registration, a feed of posts, search filters and contact between users.',
};
