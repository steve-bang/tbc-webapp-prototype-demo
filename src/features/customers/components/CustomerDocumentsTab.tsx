import { Plus } from 'lucide-react'
import { useState } from 'react'
import { CUSTOMER_DOCUMENT_TYPE_LABELS, vi } from '@/shared/i18n/vi'
import { formatDate } from '@/shared/lib/datetime'
import { Button } from '@/shared/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { CustomerDocumentDeleteDialog } from './CustomerDocumentDeleteDialog'
import { CustomerDocumentFormDialog } from './CustomerDocumentFormDialog'
import { CustomerDocumentStatusBadge } from './CustomerDocumentStatusBadge'
import { documentExpiryStatus, type Customer, type CustomerDocument } from '../model'

/** Tab "Giấy tờ" — list `CustomerDocument` + CRUD (`UC-CM-07`/`CM §22`, gate `can('CUSTOMER','EDIT')`). */
export function CustomerDocumentsTab({ customer, canEdit }: { customer: Customer; canEdit: boolean }) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingDocument, setEditingDocument] = useState<CustomerDocument | null>(null)
  const [deletingDocument, setDeletingDocument] = useState<CustomerDocument | null>(null)

  function openAdd() {
    setEditingDocument(null)
    setFormOpen(true)
  }

  function openEdit(document: CustomerDocument) {
    setEditingDocument(document)
    setFormOpen(true)
  }

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            {vi.customers.addDocument}
          </Button>
        </div>
      )}

      {customer.documents.length === 0 ? (
        <div className="border-border text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center">
          <p className="font-medium">{vi.customers.documentEmptyAll}</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{vi.customers.documentType}</TableHead>
              <TableHead>{vi.customers.documentNumber}</TableHead>
              <TableHead>{vi.customers.documentIssueDate}</TableHead>
              <TableHead>{vi.customers.documentExpiryDate}</TableHead>
              <TableHead>{vi.common.status}</TableHead>
              {canEdit && <TableHead className="text-right">{vi.common.actions}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {customer.documents.map((document) => (
              <TableRow key={document.id}>
                <TableCell>{CUSTOMER_DOCUMENT_TYPE_LABELS[document.documentType]}</TableCell>
                <TableCell>{document.documentNumber}</TableCell>
                <TableCell>{document.issueDate ? formatDate(document.issueDate) : vi.customers.noValue}</TableCell>
                <TableCell>{document.expiryDate ? formatDate(document.expiryDate) : vi.customers.noValue}</TableCell>
                <TableCell>
                  <CustomerDocumentStatusBadge status={documentExpiryStatus(document.expiryDate)} />
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(document)}>
                        {vi.common.edit}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeletingDocument(document)}>
                        {vi.common.delete}
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {canEdit && (
        <>
          <CustomerDocumentFormDialog
            customerId={customer.id}
            document={editingDocument}
            open={formOpen}
            onOpenChange={setFormOpen}
          />
          <CustomerDocumentDeleteDialog
            customerId={customer.id}
            document={deletingDocument}
            open={!!deletingDocument}
            onOpenChange={(open) => !open && setDeletingDocument(null)}
          />
        </>
      )}
    </div>
  )
}
