import nodemailer from 'nodemailer'
import type { Manoscritto, RichiestaLettura } from '@/types'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

const GESTORE_EMAIL = process.env.GESTORE_EMAIL || 'admin@melquiades.it'

// Email OTP
export async function inviaOTP(email: string, otp: string, nome?: string): Promise<void> {
  await transporter.sendMail({
    from: `"Melquíades" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Il tuo codice di accesso — Melquíades',
    html: `
      <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; background: #F5F2EC; padding: 48px 40px;">
        <div style="text-align:center; margin-bottom: 32px;">
          <p style="color: #9B7B3A; letter-spacing: 0.5em; font-size: 11px; text-transform: uppercase; margin: 0;">✦ ✦ ✦</p>
          <h1 style="color: #1C2B4A; font-size: 28px; font-weight: 400; margin: 16px 0 0;">Melquíades</h1>
        </div>
        
        <p style="color: #1C2B4A; font-size: 18px; line-height: 1.6; margin-bottom: 8px;">
          ${nome ? `Ciao ${nome},` : 'Ciao,'}
        </p>
        <p style="color: #5A6E8C; font-size: 17px; line-height: 1.6; margin-bottom: 32px;">
          Il tuo codice di accesso è:
        </p>
        
        <div style="text-align: center; padding: 24px; border: 1px solid #9B7B3A; margin-bottom: 32px;">
          <p style="color: #1C2B4A; font-size: 42px; font-weight: 500; letter-spacing: 0.2em; margin: 0;">${otp}</p>
        </div>
        
        <p style="color: #5A6E8C; font-size: 14px; line-height: 1.6; margin-bottom: 0;">
          Il codice è valido per 10 minuti.<br>
          Se non hai richiesto l'accesso, ignora questa email.
        </p>
        
        <div style="border-top: 1px solid #9B7B3A40; margin-top: 40px; padding-top: 20px; text-align: center;">
          <p style="color: #9B7B3A; font-size: 12px; margin: 0;">✦ ✦ ✦</p>
        </div>
      </div>
    `,
  })
}

// Notifica al gestore quando avviene un match
export async function notificaMatchGestore(
  manoscritto: Manoscritto,
  richiesta: RichiestaLettura,
  matchId: string,
  primoMatchLettore: boolean
): Promise<void> {
  const dataMatch = new Date().toLocaleString('it-IT', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  await transporter.sendMail({
    from: `"Melquíades Sistema" <${process.env.SMTP_USER}>`,
    to: GESTORE_EMAIL,
    subject: `✦ Nuovo match — ${manoscritto.genere}`,
    html: `
      <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; background: #F5F2EC; padding: 48px 40px;">
        <h2 style="color: #1C2B4A; font-size: 24px; font-weight: 400; margin-bottom: 24px;">
          Nuovo match avvenuto
        </h2>
        
        ${primoMatchLettore ? `
          <div style="background: #9B7B3A; color: #F5F2EC; padding: 12px 16px; margin-bottom: 24px; font-size: 14px;">
            ★ Primo match per il lettore — utente sbloccato
          </div>
        ` : ''}
        
        <table style="width: 100%; border-collapse: collapse; font-size: 16px; color: #1C2B4A;">
          <tr>
            <td style="padding: 8px 0; color: #5A6E8C; width: 140px;">Match ID</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 13px;">${matchId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #5A6E8C;">Data</td>
            <td style="padding: 8px 0;">${dataMatch}</td>
          </tr>
        </table>
        
        <div style="margin: 24px 0; border-top: 1px solid #9B7B3A40; padding-top: 24px;">
          <h3 style="color: #9B7B3A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px;">Scrittore</h3>
          <table style="width: 100%; font-size: 16px; color: #1C2B4A;">
            <tr><td style="color: #5A6E8C; width: 140px;">Nome</td><td>${manoscritto.nome_scrittore || '—'}</td></tr>
            <tr><td style="color: #5A6E8C;">Email</td><td>${manoscritto.email_scrittore}</td></tr>
            <tr><td style="color: #5A6E8C;">Genere</td><td>${manoscritto.macro_area} → ${manoscritto.genere}</td></tr>
            <tr><td style="color: #5A6E8C;">Pagine</td><td>${manoscritto.fascia_pagine}</td></tr>
            ${manoscritto.titolo ? `<tr><td style="color: #5A6E8C;">Titolo</td><td><em>${manoscritto.titolo}</em></td></tr>` : ''}
            <tr><td style="color: #5A6E8C; vertical-align: top;">Sinossi</td><td style="font-style: italic;">${manoscritto.sinossi}</td></tr>
          </table>
        </div>
        
        <div style="margin: 24px 0; border-top: 1px solid #9B7B3A40; padding-top: 24px;">
          <h3 style="color: #9B7B3A; font-size: 13px; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 16px;">Lettore</h3>
          <table style="width: 100%; font-size: 16px; color: #1C2B4A;">
            <tr><td style="color: #5A6E8C; width: 140px;">Nome</td><td>${richiesta.nome_lettore || '—'}</td></tr>
            <tr><td style="color: #5A6E8C;">Email</td><td>${richiesta.email_lettore}</td></tr>
            <tr><td style="color: #5A6E8C;">Generi</td><td>${richiesta.generi_accettati?.join(', ')}</td></tr>
            <tr><td style="color: #5A6E8C;">Max pagine</td><td>${richiesta.lunghezza_massima}</td></tr>
          </table>
        </div>
        
        <div style="border-top: 1px solid #9B7B3A40; margin-top: 40px; padding-top: 20px; text-align: center;">
          <p style="color: #9B7B3A; font-size: 12px; margin: 0;">✦ ✦ ✦</p>
          <p style="color: #5A6E8C; font-size: 12px;">Ricordati di inviare manualmente le email post-match a scrittore e lettore.</p>
        </div>
      </div>
    `,
  })
}
