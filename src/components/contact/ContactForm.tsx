"use client";

import { useState } from "react";
import { describedBy, Field, FieldError, TextArea, TextInput, inputClass } from "@/components/ui/form";
import { Icon } from "@/components/ui/Icon";
import { site } from "@/config/site";
import { contactTopics, validateContact, type ContactInput, type ContactTopic } from "@/lib/domain/contact";
import type { FieldError as FieldErrorType } from "@/lib/domain/types";

const empty = (topic: ContactTopic): ContactInput => ({
  topic,
  name: "",
  email: "",
  phone: "",
  bookingReference: "",
  message: "",
});

export function ContactForm({ initialTopic = "general" }: { initialTopic?: ContactTopic }) {
  const [values, setValues] = useState<ContactInput>(() => empty(initialTopic));
  const [errors, setErrors] = useState<FieldErrorType[]>([]);
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");

  const err = (f: string) => errors.find((e) => e.field === f)?.message;
  const set = (patch: Partial<ContactInput>) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((es) => es.filter((e) => !(e.field in patch)));
  };
  const id = (f: string) => `contact-${f}`;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const local = validateContact(values);
    if (local.length) {
      setErrors(local);
      document.getElementById(id(local[0].field))?.focus();
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, website: (form.elements.namedItem("website") as HTMLInputElement).value }),
      });
      const body = await res.json();
      if (body.ok) {
        setStatus("sent");
        return;
      }
      setErrors(body.errors ?? []);
    } catch {
      setErrors([{ field: "request", code: "SERVER_ERROR", message: "We couldn't send your message. Please email or call us instead." }]);
    }
    setStatus("idle");
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-3xl border border-line bg-white p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-success-soft text-success">
          <Icon name="check" className="size-6" />
        </span>
        <h2 className="mt-4 font-display text-2xl font-bold">Message submitted</h2>
        <p className="mt-2 text-ink-soft">
          Thanks, {values.name.split(" ")[0]}. Our online form isn&apos;t connected to our inbox yet, so please also call us
          on{" "}
          <a href={site.phone.href} className="font-semibold text-ink underline">
            {site.phone.display}
          </a>{" "}
          to make sure we get your message.
        </p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-5 rounded-3xl border border-line bg-white p-6 sm:p-8">
      <Field id={id("topic")} label="What's it about?" error={err("topic")}>
        <select
          value={values.topic}
          onChange={(e) => set({ topic: e.target.value as ContactTopic })}
          className={`${inputClass} h-13 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 12 12%22><path d=%22m3 4.5 3 3 3-3%22 fill=%22none%22 stroke=%22%234b5277%22 stroke-width=%221.6%22/></svg>')] bg-[length:14px] bg-[right_1rem_center] bg-no-repeat pr-10`}
          {...describedBy(id("topic"), err("topic"))}
        >
          {Object.entries(contactTopics).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id={id("name")} label="Name" error={err("name")}>
          <TextInput autoComplete="name" value={values.name} onChange={(e) => set({ name: e.target.value })} {...describedBy(id("name"), err("name"))} />
        </Field>
        <Field id={id("email")} label="Email" error={err("email")}>
          <TextInput
            type="email"
            inputMode="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => set({ email: e.target.value })}
            {...describedBy(id("email"), err("email"))}
          />
        </Field>
        <Field id={id("phone")} label="Phone" optional error={err("phone")}>
          <TextInput
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={values.phone}
            onChange={(e) => set({ phone: e.target.value })}
            {...describedBy(id("phone"), err("phone"))}
          />
        </Field>
        {values.topic === "booking" && (
          <Field id={id("bookingReference")} label="Booking reference" optional error={err("bookingReference")}>
            <TextInput
              placeholder="GAT-XXXXXX"
              autoCapitalize="characters"
              value={values.bookingReference}
              onChange={(e) => set({ bookingReference: e.target.value.toUpperCase() })}
              {...describedBy(id("bookingReference"), err("bookingReference"))}
            />
          </Field>
        )}
      </div>
      <Field id={id("message")} label="Message" error={err("message")}>
        <TextArea rows={5} maxLength={2000} value={values.message} onChange={(e) => set({ message: e.target.value })} {...describedBy(id("message"), err("message"))} />
      </Field>

      {/* Honeypot: invisible to people and screen readers. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <FieldError id="contact-request-error" message={err("request")} />
      <button
        type="submit"
        disabled={status === "sending"}
        className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-ink px-6 font-bold text-white transition hover:bg-night-3 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
      >
        {status === "sending" ? "Sending…" : "Send message"}
        {status !== "sending" && <Icon name="arrowRight" className="size-5" />}
      </button>
    </form>
  );
}
