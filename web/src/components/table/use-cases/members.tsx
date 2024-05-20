import { DataTable } from "@/src/components/table/data-table";
import { DataTableToolbar } from "@/src/components/table/data-table-toolbar";
import { type LangfuseColumnDef } from "@/src/components/table/types";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/src/components/ui/avatar";
import useColumnVisibility from "@/src/features/column-visibility/hooks/useColumnVisibility";
import { api } from "@/src/utils/api";
import type { RouterOutput } from "@/src/utils/types";
import { type ProjectRole, type OrganizationRole } from "@langfuse/shared";
import { useQueryParams, withDefault, NumberParam } from "use-query-params";

export type MembersTableRow = {
  orgMembershipId: string;
  userId: string;
  image: string | null;
  name: string | null;
  email: string | null;
  createdAt: Date;
  orgRole: OrganizationRole;
  defaultProjectRole?: ProjectRole;
  projectRole?: ProjectRole;
};

export default function MembersTable({
  orgId,
  projectId,
}: {
  orgId: string;
  projectId?: string;
}) {
  const [paginationState, setPaginationState] = useQueryParams({
    pageIndex: withDefault(NumberParam, 0),
    pageSize: withDefault(NumberParam, 50),
  });

  const members = api.members.all.useQuery({
    orgId,
    projectId,
    page: paginationState.pageIndex,
    limit: paginationState.pageSize,
  });
  const totalCount = members.data?.totalCount ?? 0;

  const columns: LangfuseColumnDef<MembersTableRow>[] = [
    {
      accessorKey: "name",
      id: "name",
      header: "Name",
      cell: ({ row }) => {
        const name = row.getValue("name") as MembersTableRow["name"];
        const image = row.getValue("image") as MembersTableRow["image"];
        return (
          <div className="flex items-center space-x-2">
            <Avatar className="h-7 w-7">
              <AvatarImage
                src={image ?? undefined}
                alt={name ?? "User Avatar"}
              />
              <AvatarFallback>
                {name
                  ? name
                      .split(" ")
                      .map((word) => word[0])
                      .slice(0, 2)
                      .concat("")
                  : null}
              </AvatarFallback>
            </Avatar>
            <span>{name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "email",
      id: "email",
      header: "Email",
    },
    {
      accessorKey: "orgRole",
      id: "orgRole",
      header: "Organization Role",
      enableHiding: true,
    },
    {
      accessorKey: "createdAt",
      id: "createdAt",
      header: "Member Since",
      enableHiding: true,
      defaultHidden: true,
      cell: ({ row }) => {
        const value = row.getValue("createdAt") as MembersTableRow["createdAt"];
        return value ? new Date(value).toLocaleString() : undefined;
      },
    },
    {
      accessorKey: "defaultProjectRole",
      id: "defaultProjectRole",
      header: "Default Project Role",
      enableHiding: true,
      headerTooltip: {
        description:
          "The default role for this user in all projects within this organization. Organization owners are automatically project owners.",
      },
    },
  ];

  if (projectId) {
    columns.push({
      accessorKey: "projectRole",
      id: "projectRole",
      header: "Project Role",
    });
  }

  const [columnVisibility, setColumnVisibility] =
    useColumnVisibility<MembersTableRow>("membersColumnVisibility", columns);

  const convertToTableRow = (
    orgMembership: RouterOutput["members"]["all"]["memberships"][0],
  ): MembersTableRow => {
    return {
      orgMembershipId: orgMembership.id,
      userId: orgMembership.userId,
      email: orgMembership.user.email,
      name: orgMembership.user.name,
      image: orgMembership.user.image,
      createdAt: orgMembership.createdAt,
      orgRole: orgMembership.role,
      defaultProjectRole: orgMembership.defaultProjectRole ?? undefined,
      projectRole: orgMembership.projectRole,
    };
  };

  return (
    <>
      <DataTableToolbar
        columns={columns}
        columnVisibility={columnVisibility}
        setColumnVisibility={setColumnVisibility}
      />
      <DataTable
        columns={columns}
        data={
          members.isLoading
            ? { isLoading: true, isError: false }
            : members.isError
              ? {
                  isLoading: false,
                  isError: true,
                  error: members.error.message,
                }
              : {
                  isLoading: false,
                  isError: false,
                  data: members.data.memberships.map((t) =>
                    convertToTableRow(t),
                  ),
                }
        }
        pagination={{
          pageCount: Math.ceil(totalCount / paginationState.pageSize),
          onChange: setPaginationState,
          state: paginationState,
        }}
        columnVisibility={columnVisibility}
        onColumnVisibilityChange={setColumnVisibility}
      />
    </>
  );
}
