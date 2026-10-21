import { describe, expect, it } from 'vitest';
import { groupDocumentReads } from '../../src/lib/activity';

// Spec 058 of doctiling-web (FR-033, TS-890/891): the agent now reads a large document by parts;
// every read of one document in a turn is one line, at its first read.
const read = (target: string) => ({ toolName: 'get_document', labelKey: 'kbAgent.activity.readingDocument', target });
const search = { toolName: 'search_knowledge_base', labelKey: 'kbAgent.activity.searching', target: 'penalty' };

describe('groupDocumentReads', () => {
  it('four reads of one document are one line, where the first one was', () => {
    expect(groupDocumentReads([read('Manual'), search, read('Manual'), read('Manual'), read('Manual')])).toEqual([
      { activity: read('Manual'), last: 4 },
      { activity: search, last: 1 },
    ]);
  });

  it('two documents keep a line each', () => {
    expect(groupDocumentReads([read('Manual'), read('Contrato'), read('Manual')]).map((g) => g.activity.target)).toEqual([
      'Manual',
      'Contrato',
    ]);
  });

  it('other steps are never merged, nor a read without a target', () => {
    const untargeted = { toolName: 'get_document', labelKey: 'kbAgent.activity.readingDocument' };
    expect(groupDocumentReads([search, search, untargeted, untargeted])).toHaveLength(4);
  });
});
