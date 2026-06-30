import { redirect } from 'next/navigation';

/**
 * Homepage is served from public/index.html (see next.config rewrites).
 * Contact form UI + submit: public/contact-form.js
 * API: POST /api/contact (subject with name, replyTo set)
 */
export default function Home() {
  redirect('/index.html');
}
