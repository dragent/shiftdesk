"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Alert, Button, Card } from "@/components/ui";
import {
  CONTRACT_MINUTE_OPTIONS,
  MAX_CONTRACT_HOURS,
  RECRUITMENT_CATEGORIES,
  contractMinutesFromParts,
  contractPartsFromMinutes,
  formatDateFR,
  fullName,
  jobTitle,
  selectableJobKey,
  userInitials,
} from "@/lib/employees";
import { formatMinutesAsHours } from "@/lib/planning";
import { ApiError } from "@/lib/api";
import type { ContactUpdate, JobUpdate } from "@/lib/profile";
import type { User } from "@/lib/types";

export function UserProfile({
  profile,
  isOwn,
  backToEmployees = !isOwn,
  onSaveContact,
  onSaveJob,
}: {
  profile: User;
  isOwn: boolean;
  backToEmployees?: boolean;
  onSaveContact?: (payload: ContactUpdate) => Promise<void>;
  onSaveJob?: (payload: JobUpdate) => Promise<void>;
}) {
  const status = profileStatus(profile);
  const contract =
    (profile.contractMinutes ?? 0) > 0
      ? formatMinutesAsHours(profile.contractMinutes ?? 0)
      : "Non renseigné";

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      {backToEmployees && (
        <Link
          href="/direction/employes"
          className="w-fit text-sm font-semibold text-cf-blue hover:underline"
        >
          ← Retour aux employés
        </Link>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cf-red text-xl font-bold text-white sm:h-20 sm:w-20 sm:text-2xl"
        >
          {userInitials(profile)}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-slate-800">
            {isOwn ? "Mon profil" : fullName(profile)}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{jobTitle(profile)}</p>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
          >
            {status.label}
          </span>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Coordonnées">
          {isOwn && onSaveContact ? (
            <ContactForm profile={profile} onSave={onSaveContact} />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <ProfileField label="Nom">{fullName(profile)}</ProfileField>
              <ProfileField label="Email">
                <a
                  href={`mailto:${profile.email}`}
                  className="break-all text-cf-blue hover:underline"
                >
                  {profile.email}
                </a>
              </ProfileField>
              <ProfileField label="Téléphone">
                {profile.phone ? (
                  <a
                    href={`tel:${profile.phone.replace(/\s/g, "")}`}
                    className="text-cf-blue hover:underline"
                  >
                    {profile.phone}
                  </a>
                ) : (
                  <span className="text-slate-400">Non renseigné</span>
                )}
              </ProfileField>
            </div>
          )}
        </Card>

        <Card title="Poste">
          {onSaveJob ? (
            <JobForm profile={profile} onSave={onSaveJob} />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <ProfileField label="Fonction">{jobTitle(profile)}</ProfileField>
              <ProfileField label="Contrat hebdomadaire">{contract}</ProfileField>
              {profile.cashierNumber ? (
                <ProfileField label="N° caissier">{profile.cashierNumber}</ProfileField>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ContactForm({
  profile,
  onSave,
}: {
  profile: User;
  onSave: (payload: ContactUpdate) => Promise<void>;
}) {
  const [email, setEmail] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setEmail(profile.email);
    setPhone(profile.phone ?? "");
  }, [profile.email, profile.phone]);

  const dirty = email.trim() !== profile.email || phone.trim() !== (profile.phone ?? "");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await onSave({ email: email.trim(), phone: phone.trim() || null });
      setSuccess("Coordonnées enregistrées.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer les coordonnées.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <ProfileField label="Nom">{fullName(profile)}</ProfileField>
      <label className="block text-sm font-medium text-slate-700">
        Email
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Téléphone
        <input
          type="tel"
          maxLength={30}
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="06 12 34 56 78"
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 px-2.5 py-2 text-sm"
        />
      </label>
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
      <Button
        type="submit"
        aria-label="Enregistrer les coordonnées"
        className="w-full sm:w-auto sm:self-end"
        disabled={saving || !dirty}
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

function JobForm({
  profile,
  onSave,
}: {
  profile: User;
  onSave: (payload: JobUpdate) => Promise<void>;
}) {
  const jobKey = selectableJobKey(profile);
  const contractMinutes = profile.contractMinutes ?? 0;
  const initialParts = contractPartsFromMinutes(contractMinutes);
  const [role, setRole] = useState(jobKey);
  const [hours, setHours] = useState(String(initialParts.hours));
  const [extraMinutes, setExtraMinutes] = useState(initialParts.extraMinutes);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const parts = contractPartsFromMinutes(contractMinutes);
    setRole(jobKey);
    setHours(String(parts.hours));
    setExtraMinutes(parts.extraMinutes);
  }, [jobKey, contractMinutes]);

  const nextMinutes = contractMinutesFromParts(hours, extraMinutes);
  const dirty = role !== jobKey || nextMinutes !== contractMinutes;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await onSave({
        ...(role ? { role } : {}),
        contractMinutes: nextMinutes,
      });
      setSuccess("Poste et contrat enregistrés.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer le poste.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block text-sm font-medium text-slate-700">
        Fonction
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="mt-1 min-h-11 w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
        >
          {jobKey === "" && (
            <option value="">{jobTitle(profile)}</option>
          )}
          {RECRUITMENT_CATEGORIES.map((category) =>
            category.jobs.length === 1 ? (
              <option key={category.key} value={category.jobs[0].value}>
                {category.jobs[0].label}
              </option>
            ) : (
              <optgroup key={category.key} label={category.label}>
                {category.jobs.map((job) => (
                  <option key={job.value} value={job.value}>
                    {job.label}
                  </option>
                ))}
              </optgroup>
            ),
          )}
        </select>
      </label>

      <div>
        <span className="block text-sm font-medium text-slate-700">Contrat hebdomadaire</span>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="profile-contract-hours">
            Heures par semaine
          </label>
          <input
            id="profile-contract-hours"
            type="number"
            required
            min={0}
            max={MAX_CONTRACT_HOURS}
            step={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            className="min-h-11 w-20 rounded-md border border-slate-300 px-2.5 py-2 text-sm"
          />
          <span className="text-sm text-slate-600" aria-hidden>
            h
          </span>
          <label className="sr-only" htmlFor="profile-contract-minutes">
            Minutes
          </label>
          <select
            id="profile-contract-minutes"
            value={extraMinutes}
            onChange={(e) => setExtraMinutes(Number(e.target.value))}
            className="min-h-11 w-20 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm"
          >
            {CONTRACT_MINUTE_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {String(minutes).padStart(2, "0")}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-600" aria-hidden>
            min
          </span>
        </div>
      </div>

      {profile.cashierNumber ? (
        <ProfileField label="N° caissier">{profile.cashierNumber}</ProfileField>
      ) : null}
      {error && <Alert>{error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
      <Button
        type="submit"
        aria-label="Enregistrer le poste"
        className="w-full sm:w-auto sm:self-end"
        disabled={saving || !dirty}
      >
        {saving ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

function ProfileField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-0.5 font-medium text-slate-800">{children}</div>
    </div>
  );
}

function profileStatus(user: User): { label: string; className: string } {
  if (!user.active) {
    return {
      label: user.dismissedAt
        ? `Licencié le ${formatDateFR(user.dismissedAt)}`
        : "Compte inactif",
      className: "bg-slate-100 text-slate-600",
    };
  }
  if (user.dismissedAt) {
    return {
      label: `Départ le ${formatDateFR(user.dismissedAt)}`,
      className: "bg-amber-100 text-amber-800",
    };
  }
  return { label: "En emploi", className: "bg-emerald-100 text-emerald-700" };
}
