import React from "react";

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 space-y-6">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">Privacy Policy</h1>
      <p className="text-xs text-slate-500">Effective Date: November 2026</p>

      <section className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">1. Data Ownership</h2>
        <p>
          You retain complete ownership of all documents, images, and files you upload to BricDoc. We do not claim any copyright or proprietary rights over your content.
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">2. Processing & Storage</h2>
        <p>
          Files processed anonymously through public PDF tools are kept only in temporary processing memory and are deleted automatically. Files stored in an authenticated user&apos;s Document Vault are held in private storage accessible only via authenticated session tokens.
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">3. AI Processing</h2>
        <p>
          When you use AI Document Intelligence (Summarization, Q&amp;A, Extraction), document text is sent to our AI model provider solely to complete the requested analysis and is never used to train machine learning models.
        </p>

        <h2 className="text-base font-bold text-slate-900 dark:text-white">4. Account Deletion & Data Portability</h2>
        <p>
          You can delete your documents or entire account at any time. Permanent deletion permanently unlinks and deletes all stored files from our disks.
        </p>
      </section>
    </div>
  );
}
