import { auditLog } from "@/src/features/audit-logs/auditLog";
import { sendProjectInvitation } from "@/src/features/email/lib/project-invitation";
import { throwIfNoProjectAccess } from "@/src/features/rbac/utils/checkProjectAccess";
import {
  createTRPCRouter,
  protectedOrganizationProcedure,
} from "@/src/server/api/trpc";
import { ProjectRole } from "@langfuse/shared/src/db";
import { TRPCError } from "@trpc/server";
import * as z from "zod";
import { throwIfNoOrganizationAccess } from "@/src/features/rbac/utils/checkOrganizationAccess";
import { paginationZod } from "@/src/utils/zod";

export const membersRouter = createTRPCRouter({
  all: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
        projectId: z.string().optional(), // optional, view project_role for specific project
        ...paginationZod,
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "members:view",
      });
      const orgMemberships = await ctx.prisma.organizationMembership.findMany({
        where: {
          orgId: input.orgId,
        },
        include: {
          user: {
            select: {
              image: true,
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          user: {
            email: "asc",
          },
        },
        take: input.limit,
        skip: input.page * input.limit,
      });

      const totalCount = await ctx.prisma.organizationMembership.count({
        where: {
          orgId: input.orgId,
        },
      });

      const projectMemberships = input.projectId
        ? await ctx.prisma.projectMembership.findMany({
            select: {
              userId: true,
              role: true,
            },
            where: {
              orgMembershipId: {
                in: orgMemberships.map((m) => m.id),
              },
              projectId: input.projectId,
            },
          })
        : [];

      return {
        memberships: orgMemberships.map((om) => ({
          ...om,
          projectRole: projectMemberships.find((pm) => pm.userId === om.userId)
            ?.role,
        })),
        totalCount,
      };
    }),
  allInvites: protectedOrganizationProcedure
    .input(
      z.object({
        orgId: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      throwIfNoOrganizationAccess({
        session: ctx.session,
        organizationId: input.orgId,
        scope: "members:view",
      });
      const invitations = await ctx.prisma.membershipInvitation.findMany({
        where: {
          orgId: input.orgId,
        },
        include: {
          sender: {
            select: {
              name: true,
            },
          },
        },
      });

      return { invitations };
    }),
});

// delete: protectedProjectProcedure
//   .input(
//     z.object({
//       projectId: z.string(),
//       userId: z.string(),
//     }),
//   )
//   .mutation(async ({ input, ctx }) => {
//     throwIfNoProjectAccess({
//       session: ctx.session,
//       projectId: input.projectId,
//       scope: "members:delete",
//     });

//     if (input.userId === ctx.session.user.id)
//       throw new Error("You cannot remove yourself from a project");

//     const membership = await ctx.prisma.projectMembership.findFirst({
//       where: {
//         projectId: input.projectId,
//         userId: input.userId,
//         role: {
//           not: ProjectRole.OWNER,
//         },
//       },
//     });

//     if (!membership) throw new TRPCError({ code: "NOT_FOUND" });

//     await auditLog({
//       session: ctx.session,
//       resourceType: "membership",
//       resourceId: membership.projectId + "--" + membership.userId,
//       action: "delete",
//       before: membership,
//     });

//     // use ids from membership to make sure owners cannot delete themselves
//     return await ctx.prisma.projectMembership.delete({
//       where: {
//         projectId_userId: {
//           projectId: membership.projectId,
//           userId: membership.userId,
//         },
//       },
//     });
//   }),
// deleteInvitation: protectedProjectProcedure
//   .input(
//     z.object({
//       id: z.string(),
//       projectId: z.string(),
//     }),
//   )
//   .mutation(async ({ input, ctx }) => {
//     throwIfNoProjectAccess({
//       session: ctx.session,
//       projectId: input.projectId,
//       scope: "members:delete",
//     });

//     await auditLog({
//       session: ctx.session,
//       resourceType: "membershipInvitation",
//       resourceId: input.id,
//       action: "delete",
//     });

//     return await ctx.prisma.membershipInvitation.delete({
//       where: {
//         id: input.id,
//         projectId: input.projectId,
//       },
//     });
//   }),
// create: protectedProjectProcedure
//   .input(
//     z.object({
//       projectId: z.string(),
//       email: z.string().email(),
//       role: z.enum([
//         ProjectRole.ADMIN,
//         ProjectRole.MEMBER,
//         ProjectRole.VIEWER,
//       ]),
//     }),
//   )
//   .mutation(async ({ input, ctx }) => {
//     throwIfNoProjectAccess({
//       session: ctx.session,
//       projectId: input.projectId,
//       scope: "members:create",
//     });

//     const user = await ctx.prisma.user.findUnique({
//       where: {
//         email: input.email.toLowerCase(),
//       },
//     });
//     if (user) {
//       const membership = await ctx.prisma.projectMembership.create({
//         data: {
//           userId: user.id,
//           projectId: input.projectId,
//           role: input.role,
//         },
//       });
//       await auditLog({
//         session: ctx.session,
//         resourceType: "membership",
//         resourceId: input.projectId + "--" + user.id,
//         action: "create",
//         after: membership,
//       });
//       return membership;
//     } else {
//       const invitation = await ctx.prisma.membershipInvitation.create({
//         data: {
//           projectId: input.projectId,
//           email: input.email.toLowerCase(),
//           role: input.role,
//           senderId: ctx.session.user.id,
//         },
//       });
//       await auditLog({
//         session: ctx.session,
//         resourceType: "membershipInvitation",
//         resourceId: invitation.id,
//         action: "create",
//         after: invitation,
//       });

//       const project = await ctx.prisma.project.findFirst({
//         where: {
//           id: input.projectId,
//         },
//       });

//       if (!project) throw new Error("Project not found");

//       await sendProjectInvitation(
//         input.email,
//         ctx.session.user.name!,
//         ctx.session.user.email!,
//         project.name,
//       );

//       return invitation;
//     }
//   }),
