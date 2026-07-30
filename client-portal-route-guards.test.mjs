import assert from "node:assert/strict";
import test from "node:test";

import {
  loadClientPortalWorkspaceDetails,
  resolveClientPortalProjectDetail,
} from "./web/lib/client-portal-route-guards.mjs";

const viewer = { id: "client-user", email: "hiring@client.ai" };

function project(id = "project-1") {
  return { id, user_id: "owner-1", name: id };
}

test("loads workspace details from one fresh batch authorization read", async () => {
  let authorizationReads = 0;
  let detailReads = 0;
  const projects = Array.from({ length: 30 }, (_, index) => project(`project-${index + 1}`));

  const result = await loadClientPortalWorkspaceDetails({
    viewer,
    locale: "zh",
    dependencies: {
      findAuthorizedProjects: async () => {
        authorizationReads += 1;
        return projects;
      },
      loadProjectDetail: async (currentProject) => {
        detailReads += 1;
        return { project: currentProject };
      },
    },
  });

  assert.equal(authorizationReads, 1);
  assert.equal(detailReads, 30);
  assert.deepEqual(result.projects.map((item) => item.id), projects.map((item) => item.id));
  assert.equal(Object.keys(result.projectDetails).length, 30);
});

test("returns revoked without loading detail when access changes after the initial lookup", async () => {
  let detailReads = 0;
  const result = await resolveClientPortalProjectDetail({
    viewer,
    projectId: "project-1",
    locale: "zh",
    dependencies: {
      findInitialAuthorizedProject: async () => project(),
      recheckAuthorizedProject: async () => null,
      verifyProjectAccess: () => ({ allowed: true }),
      loadProjectDetail: async () => {
        detailReads += 1;
        return { project: project() };
      },
    },
  });

  assert.equal(result.status, "revoked");
  assert.equal(detailReads, 0);
});

test("keeps unknown or initially unauthorized projects indistinguishable as not found", async () => {
  let rechecks = 0;
  const result = await resolveClientPortalProjectDetail({
    viewer,
    projectId: "unknown-project",
    dependencies: {
      findInitialAuthorizedProject: async () => null,
      recheckAuthorizedProject: async () => {
        rechecks += 1;
        return project();
      },
      verifyProjectAccess: () => ({ allowed: true }),
      loadProjectDetail: async () => ({ project: project() }),
    },
  });

  assert.equal(result.status, "not_found");
  assert.equal(rechecks, 0);
});
