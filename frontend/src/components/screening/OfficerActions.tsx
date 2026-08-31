'use client';

import * as React from 'react';
import { useState } from 'react';
import {
  CheckCircle2,
  ShieldAlert,
  RefreshCw,
  MessageSquarePlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea } from '@/components/ui/Input';
import type { CaseReview, ReviewAction, CaseStatus } from '@/lib/types/screening';
import { REVIEW_ACTION_LABELS } from '@/lib/types/screening';
import { formatDateShort, formatRelative } from '@/lib/utils/dates';
import { cn } from '@/lib/utils/cn';

export interface OfficerActionsProps {
  caseId: string;
  status: CaseStatus;
  review?: CaseReview;
  onSubmitReview: (input: { action: ReviewAction; note?: string; reason?: string }) => Promise<void>;
  isSubmitting?: boolean;
  canReview?: boolean;
  className?: string;
}

export function OfficerActions({
  caseId,
  status,
  review,
  onSubmitReview,
  isSubmitting = false,
  canReview = true,
  className,
}: OfficerActionsProps) {
  const [activeModal, setActiveModal] = useState<ReviewAction | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [noteInput, setNoteInput] = useState('');

  const handleOpenModal = (action: ReviewAction) => {
    setReasonInput('');
    setNoteInput('');
    setActiveModal(action);
  };

  const handleConfirmAction = async () => {
    if (!activeModal) return;
    await onSubmitReview({
      action: activeModal,
      reason: reasonInput.trim() || undefined,
      note: noteInput.trim() || undefined,
    });
    setActiveModal(null);
  };

  return (
    <div className={cn('panel p-5 space-y-4', className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider font-mono text-foreground">
              Officer Decision & Review Console
            </h4>
            <span className="font-mono text-[10px] text-muted-foreground bg-surface-muted px-2 py-0.5 rounded border border-border">
              Case {caseId}
            </span>
          </div>
          <p className="text-2xs text-muted-foreground mt-0.5">
            Submit formal disposition. Actions are immutably appended to the checkpoint audit trail.
          </p>
        </div>

        {/* Action Buttons */}
        {canReview && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenModal('ADD_NOTE')}
              disabled={isSubmitting}
            >
              <MessageSquarePlus className="size-3.5 mr-1.5" />
              <span>Add Note</span>
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenModal('REQUEST_RECAPTURE')}
              disabled={isSubmitting}
            >
              <RefreshCw className="size-3.5 mr-1.5" />
              <span>Request Re-Capture</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleOpenModal('ESCALATE')}
              disabled={isSubmitting}
            >
              <ShieldAlert className="size-3.5 mr-1.5" />
              <span>Escalate Case</span>
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={() => handleOpenModal('MARK_REVIEWED')}
              disabled={isSubmitting}
              className="shadow-sm shadow-primary/20"
            >
              <CheckCircle2 className="size-3.5 mr-1.5" />
              <span>Mark as Reviewed</span>
            </Button>
          </div>
        )}
      </div>

      {/* Review Outcomes / Notes Timeline */}
      {review && (
        <div className="rounded-xl border border-border bg-surface-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2 text-2xs font-mono text-muted-foreground">
            <span>Recorded Review Outcome: <strong className="text-foreground">{review.outcome ?? 'PENDING ACTION'}</strong></span>
            {review.reviewedBy && (
              <span>Reviewed by <strong>{review.reviewedBy}</strong> {review.reviewedAt ? `(${formatRelative(review.reviewedAt)})` : ''}</span>
            )}
          </div>

          {review.notes && review.notes.length > 0 ? (
            <div className="space-y-2">
              <span className="text-2xs font-mono uppercase tracking-wider text-muted-foreground">
                Case Notes ({review.notes.length})
              </span>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {review.notes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3 rounded-lg border border-border bg-surface text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-2xs font-mono text-muted-foreground">
                      <span className="font-semibold text-foreground">
                        {note.author} ({note.authorRole})
                      </span>
                      <span>{formatRelative(note.createdAt)}</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed">{note.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No case notes added yet.</p>
          )}
        </div>
      )}

      {/* Action Dialog / Modal */}
      {activeModal && (
        <Modal
          open={true}
          onClose={() => setActiveModal(null)}
          title={REVIEW_ACTION_LABELS[activeModal]}
        >
          <div className="space-y-4 text-xs">
            <p className="text-muted-foreground">
              {activeModal === 'MARK_REVIEWED'
                ? 'Confirm that you have reviewed the extracted evidence and forensic signals. You may attach an optional note.'
                : activeModal === 'ESCALATE'
                  ? 'Escalate this case to a supervisor for secondary inspection. Please provide the reason for escalation.'
                  : activeModal === 'REQUEST_RECAPTURE'
                    ? 'Request a new image capture from the traveller due to glare, blur, or framing issues.'
                    : 'Add an investigative note or observations to this screening record.'}
            </p>

            {activeModal === 'ESCALATE' && (
              <div className="space-y-1.5">
                <label className="font-mono text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Escalation Reason (Required)
                </label>
                <Input
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g. Document text anomaly detected in DOB region"
                  autoFocus
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="font-mono text-2xs uppercase tracking-wider text-muted-foreground font-semibold">
                Officer Notes / Remarks
              </label>
              <Textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Enter detailed observations for the case record..."
                rows={3}
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveModal(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant={activeModal === 'ESCALATE' ? 'destructive' : 'default'}
                size="sm"
                onClick={handleConfirmAction}
                disabled={isSubmitting || (activeModal === 'ESCALATE' && !reasonInput.trim())}
              >
                {isSubmitting ? 'Recording...' : 'Confirm Action'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
