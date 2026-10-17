import 'dart:io' show File;
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../data/letter_store.dart';
import 'pdf_engine.dart';

/// Letter completion pipeline: render → persist → return the finished record.
Future<LetterDraft> finalizeLetter(LetterDraft draft, LetterStore store) async {
  final bytes = await renderLetterPdf(
    to: draft.to,
    date: draft.date,
    salutation: draft.salutation,
    body: draft.body,
    signatureBytes: draft.signatureBytes,
    paperFormat: draft.paperFormat,
  );

  final path = await savePdfToDocuments(bytes, 'Letter_${draft.id}.pdf');
  final finished = LetterDraft(
    id: draft.id,
    createdAt: draft.createdAt,
    to: draft.to,
    date: draft.date,
    salutation: draft.salutation,
    body: draft.body,
    signatureBytes: draft.signatureBytes,
    pdfPath: path,
    paperFormat: draft.paperFormat,
  );
  await store.save(finished);
  return finished;
}

/// Local File Sandboxing (PRD NFR): generated PDFs are written ONLY to the
/// application's private documents directory — never to public storage — so
/// unrelated device apps cannot scan sensitive generated documents.
Future<String> savePdfToDocuments(Uint8List bytes, String fileName) async {
  if (kIsWeb) {
    // Web target: no private directory exists; bytes stay in memory and
    // exports happen via the preview screen (browser print/download).
    return fileName;
  }
  final dir = await getApplicationDocumentsDirectory();
  final file = File('${dir.path}/$fileName');
  await file.writeAsBytes(bytes);
  return file.path;
}

/// Native System Exports (PRD 3.3): dispatch via the device share sheet —
/// this routes to email clients, messaging apps, or cloud drives the user
/// already controls, with no intermediate servers.
Future<void> sharePdf({
  required String subject,
  required String? filePath,
  Uint8List? bytes,
  required String fileName,
}) async {
  final XFile file;
  if (kIsWeb) {
    file = XFile.fromData(
      bytes!,
      mimeType: 'application/pdf',
      name: fileName,
    );
  } else {
    file = XFile(filePath!, mimeType: 'application/pdf');
  }
  await Share.shareXFiles([file], subject: subject);
}
