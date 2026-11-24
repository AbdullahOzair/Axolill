"use client";

import type { TeamMember } from "@/lib/data-model";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChipInput } from "@/components/admin/cms/chip-input";
import { CmsManager } from "@/components/admin/cms/cms-manager";
import { Field, type FieldErrors } from "@/components/admin/form-dialog";
import { ImageUpload } from "@/components/admin/cms/image-upload";
import { TEAM_LINK_LIMIT, teamProfileUrl } from "@/lib/team-links";

type Draft = {
  name: string;
  role: string;
  bio: string;
  skills: string[];
  photoUrl: string | null;
  linkedinUrl: string;
  portfolioUrl: string;
  order: number;
  published: boolean;
};

const EMPTY: Draft = {
  name: "",
  role: "",
  bio: "",
  skills: [],
  photoUrl: null,
  linkedinUrl: "",
  portfolioUrl: "",
  order: 0,
  published: false,
};

const initials = (name: string) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export function TeamView() {
  return (
    <CmsManager<TeamMember, Draft>
      title="Team"
      description="The people shown in the Meet the Team section."
      endpoint="/api/team"
      listKey="team"
      addLabel="Add member"
      emptyDraft={EMPTY}
      labelOf={(m) => m.name}
      toDraft={(m) => ({
        name: m.name,
        role: m.role,
        bio: m.bio,
        skills: m.skills,
        photoUrl: m.photoUrl,
        linkedinUrl: m.linkedinUrl ?? "",
        portfolioUrl: m.portfolioUrl ?? "",
        order: m.order,
        published: m.published,
      })}
      validate={(d) => {
        const e: FieldErrors = {};
        if (!d.name.trim()) e.name = "Name is required.";
        if (!d.role.trim()) e.role = "What's their role?";
        if (d.linkedinUrl.trim() && !teamProfileUrl(d.linkedinUrl)) e.linkedinUrl = "Enter a valid HTTP or HTTPS URL.";
        if (d.portfolioUrl.trim() && !teamProfileUrl(d.portfolioUrl)) e.portfolioUrl = "Enter a valid HTTP or HTTPS URL.";
        return e;
      }}
      columns={[
        {
          header: "Member",
          cell: (m) => (
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                {m.photoUrl && (
                  <AvatarImage src={`/api/media/${m.photoUrl}`} alt="" />
                )}
                <AvatarFallback className="brand-action text-xs font-semibold text-white">
                  {initials(m.name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{m.name}</span>
            </div>
          ),
        },
        {
          header: "Role",
          cell: (m) => (
            <span className="text-muted-foreground">{m.role}</span>
          ),
          className: "w-56",
        },
        {
          header: "Skills",
          cell: (m) => (
            <span className="text-muted-foreground">
              {m.skills.length || "—"}
            </span>
          ),
          className: "w-20",
        },
      ]}
      renderForm={(d, patch, errors) => (
        <>
          <Field
            id="tm-photo"
            label="Photo"
            hint="Optional — falls back to initials."
            error={errors.photoUrl}
          >
            {() => (
              <ImageUpload
                value={d.photoUrl}
                onChange={(photoUrl) => patch({ photoUrl })}
                label="photo"
              />
            )}
          </Field>

          <Field id="tm-name" label="Name" error={errors.name} required>
            {(f) => (
              <Input
                {...f}
                value={d.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="Abdullah Ozair"
              />
            )}
          </Field>

          <Field id="tm-role" label="Role" error={errors.role} required>
            {(f) => (
              <Input
                {...f}
                value={d.role}
                onChange={(e) => patch({ role: e.target.value })}
                placeholder="Full Stack Developer"
              />
            )}
          </Field>

          <Field id="tm-bio" label="Bio" error={errors.bio}>
            {(f) => (
              <Textarea
                {...f}
                rows={3}
                value={d.bio}
                onChange={(e) => patch({ bio: e.target.value })}
              />
            )}
          </Field>

          <Field
            id="tm-skills"
            label="Skills or expertise"
            hint="Press Enter after each one. Up to 16."
            error={errors.skills}
          >
            {(f) => (
              <ChipInput
                id={f.id}
                value={d.skills}
                onChange={(skills) => patch({ skills })}
                placeholder="e.g. TypeScript"
                max={16}
              />
            )}
          </Field>

          <Field id="tm-linkedin" label="LinkedIn URL" error={errors.linkedinUrl}>
            {(f) => (
              <Input {...f} type="url" maxLength={TEAM_LINK_LIMIT} value={d.linkedinUrl}
                onChange={(e) => patch({ linkedinUrl: e.target.value })} />
            )}
          </Field>

          <Field id="tm-portfolio" label="Portfolio URL" error={errors.portfolioUrl}>
            {(f) => (
              <Input {...f} type="url" maxLength={TEAM_LINK_LIMIT} value={d.portfolioUrl}
                onChange={(e) => patch({ portfolioUrl: e.target.value })} />
            )}
          </Field>

          <Field
            id="tm-order"
            label="Order"
            hint="Lower numbers appear first."
            error={errors.order}
          >
            {(f) => (
              <Input
                {...f}
                type="number"
                min={0}
                value={d.order}
                onChange={(e) => patch({ order: Number(e.target.value) || 0 })}
              />
            )}
          </Field>
        </>
      )}
    />
  );
}
