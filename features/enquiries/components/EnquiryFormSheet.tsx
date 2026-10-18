"use client";

import { FormPage } from "@/components/ui/FormPage";
import { useCloseOnBack } from "@/lib/hooks/useCloseOnBack";

/** A FORM ON AN ENQUIRY OPENS AS A SHEET (18 Oct 2026, the user: "quote should
 *  open like a form when adding or revising", "add a practice should open a form
 *  in enquiry as well"). The app's one form anatomy (`FormPage sheet`) over the
 *  enquiry page; mounted only while open, so system back closes it and a
 *  button-close spends its history entry (`useCloseOnBack`, the way
 *  `FormConfirm` does it). The caller's fields put their buttons in a `FormBar`. */
export function EnquiryFormSheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useCloseOnBack(onClose, true);
  return (
    <FormPage sheet title={title} onBack={onClose} onClose={onClose}>
      {children}
    </FormPage>
  );
}
