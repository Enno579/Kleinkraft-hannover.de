import { redirect } from 'next/navigation';

/**
 * Homepage is served from public/index.html (see next.config rewrites).
 * Contact form submit handler: public/contact-form.js
 * API: POST /api/contact
 */
export default function Home() {
  redirect('/index.html');
}
