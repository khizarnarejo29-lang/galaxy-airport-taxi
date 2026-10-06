import { z } from "zod";
import { badRequest, readJson } from "@/lib/api/schemas";
import { contactTopics, validateContact, type ContactTopic } from "@/lib/domain/contact";
import { getServices } from "@/lib/services";

const schema = z.object({
  topic: z.enum(Object.keys(contactTopics) as [ContactTopic, ...ContactTopic[]]),
  name: z.string().max(200),
  email: z.string().max(300),
  phone: z.string().max(40).optional(),
  bookingReference: z.string().max(40).optional(),
  message: z.string().max(4000),
  /** Honeypot: hidden from people, often filled in by bots. */
  website: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return badRequest();
  const { website, ...input } = parsed.data;

  // Pretend success to bots so they don't retry.
  if (website) return Response.json({ ok: true });

  const errors = validateContact(input);
  if (errors.length) return Response.json({ ok: false, errors }, { status: 422 });

  try {
    await getServices().notifier.contactEnquiry(input);
  } catch (err) {
    console.error("[contact] enquiry could not be sent", err);
    return Response.json(
      { ok: false, errors: [{ field: "request", code: "SERVER_ERROR", message: "We couldn't send your message. Please email or call us instead." }] },
      { status: 502 },
    );
  }
  return Response.json({ ok: true });
}
