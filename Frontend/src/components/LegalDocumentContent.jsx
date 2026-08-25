import React, { useMemo } from 'react';
import { parseLegalDocument } from '../utils/legalDocumentParser';

const blockClasses = {
    'document-type': 'text-center font-bold uppercase text-[19px] mt-8 mb-1 tracking-wide',
    'center-heading': 'text-center font-bold uppercase text-[16px] mb-5 leading-snug',
    chapter: 'text-center font-bold text-[16px] mt-8 mb-2 leading-snug',
    section: 'text-center font-bold text-[15px] mt-6 mb-2 leading-snug',
    article: 'font-bold text-[15px] mt-6 mb-2 text-left',
    clause: 'pl-5 text-[14.5px] leading-7 text-justify mb-2',
    point: 'pl-10 text-[14.5px] leading-7 text-justify mb-2',
    preamble: 'text-[14.5px] leading-7 text-justify mb-2 italic',
    paragraph: 'text-[14.5px] leading-7 text-justify mb-2',
    'signature-title': 'ml-auto w-full sm:w-1/2 text-center font-bold uppercase text-[14.5px] mt-12 mb-2',
    'signature-note': 'ml-auto w-full sm:w-1/2 text-center italic text-[14px] mb-2',
    'signature-name': 'ml-auto w-full sm:w-1/2 text-center font-bold text-[14.5px] mb-2',
    'certification-office': 'ml-auto w-full sm:w-1/2 text-center font-bold uppercase text-[14px] mt-12 mb-1 border-t border-zinc-200 pt-5',
    'certification-heading': 'ml-auto w-full sm:w-1/2 text-center font-bold uppercase text-[14px] mt-2 mb-1',
    'certification-meta': 'ml-auto w-full sm:w-1/2 text-center italic text-[13.5px] mb-1',
    'certification-title': 'ml-auto w-full sm:w-1/2 text-center font-bold uppercase text-[14px] mt-3 mb-1',
    'certification-note': 'ml-auto w-full sm:w-1/2 text-center italic text-[13.5px] mb-1',
    'certification-name': 'ml-auto w-full sm:w-1/2 text-center font-bold text-[14px] mb-1'
};

export default function LegalDocumentContent({ content, title, parsedDocument: suppliedDocument }) {
    const parsedFromContent = useMemo(() => parseLegalDocument(content, title), [content, title]);
    const document = suppliedDocument || parsedFromContent;

    return (
        <>
            {!document.hasDocumentHeading && !document.contentRepresentsTitle && (
                <h2 className="text-center text-[19px] font-bold uppercase mt-8 mb-10 leading-snug">{title}</h2>
            )}
            <div className="mx-auto max-w-[760px]">
                {document.blocks.map(block => (
                    <p key={block.id} id={`legal-${block.id}`} className={`scroll-mt-24 ${blockClasses[block.type] || blockClasses.paragraph}`}>
                        {block.text}
                    </p>
                ))}
            </div>
        </>
    );
}
