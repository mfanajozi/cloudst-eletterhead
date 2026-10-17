import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import 'brand.dart';

/// Dynamic Background Merger Assembly (PRD 3.3).
///
/// Layer 1 — the client's embedded letterhead PDF (pure background geometry:
/// headers, footers, addresses) rendered full-bleed.
/// Layer 2 — form-capture variables mapped into the open regions via
/// font-metric-safe paddings.
/// Layer 3 — the vector signature (transparent PNG) below the text column.
///
/// The body region is a fixed-height block that clips cleanly BEFORE it can
/// collide with footer geometry (PRD: Input Area Layout Preservation).
Future<Uint8List> renderLetterPdf({
  required String to,
  required String date,
  required String salutation,
  required String body,
  Uint8List? signatureBytes,
  required String paperFormat, // 'A4' | 'Letter'
}) async {
  final pageFormat =
      (paperFormat == 'Letter') ? PdfPageFormat.letter : PdfPageFormat.a4;

  final pdf = pw.Document();
  final letterheadBytes = await _loadEmbeddedLetterhead();

  // Signature block, bottom-right, underline bar + caption.
  final signatureBlock = pw.Align(
    alignment: pw.Alignment.bottomRight,
    child: pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Container(
          height: 60,
          width: 150,
          decoration: const pw.BoxDecoration(
            border: pw.Border(
              bottom: pw.BorderSide(width: 0.5, color: PdfColors.grey),
            ),
          ),
          child: signatureBytes != null
              ? pw.Image(pw.MemoryImage(signatureBytes), fit: pw.BoxFit.contain)
              : null,
        ),
        pw.SizedBox(height: 4),
        pw.Text(
          'Authorised Signature',
          style: pw.TextStyle(fontSize: 10, color: PdfColors.grey600),
        ),
      ],
    ),
  );

  pdf.addPage(
    pw.Page(
      pageFormat: pageFormat,
      build: (pw.Context context) => pw.FullPage(
        ignoreMargins: false,
        child: pw.Stack(
          children: [
            // ── Layer 1: client letterhead as full-bleed background ──
            if (letterheadBytes != null)
              pw.Positioned.fill(
                child: pw.Image(
                  pw.MemoryImage(letterheadBytes),
                  fit: pw.BoxFit.fill,
                ),
              ),

            // ── Layers 2 + 3: content mapped over the open regions ──
            pw.Padding(
              padding: const pw.EdgeInsets.all(40),
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  // Reserve clear space for the letterhead header art.
                  pw.SizedBox(height: 100),
                  pw.Align(
                    alignment: pw.Alignment.topRight,
                    child: pw.Text(
                      'Date: $date',
                      style: const pw.TextStyle(fontSize: 12),
                    ),
                  ),
                  pw.SizedBox(height: 20),
                  pw.Text(
                    'To:\n$to',
                    style: const pw.TextStyle(
                      fontSize: 12,
                      fontWeight: pw.FontWeight.bold,
                    ),
                  ),
                  pw.SizedBox(height: 30),
                  pw.Text(salutation,
                      style: const pw.TextStyle(fontSize: 12)),
                  pw.SizedBox(height: 15),

                  // Body: fixed-height clip zone — breaks cleanly at the
                  // bottom edge instead of running into footer geometry.
                  pw.SizedBox(
                    height: (pageFormat.height * 0.52) - 80,
                    child: pw.Text(
                      body,
                      style: const pw.TextStyle(
                        fontSize: 12,
                        height: 1.5,
                      ),
                      softWrap: true,
                      overflow: pw.TextOverflow.clip,
                    ),
                  ),

                  pw.Spacer(),
                  signatureBlock,
                ],
              ),
            ),
          ],
        ),
      ),
    ),
  );

  return pdf.save();
}

/// Embedded letterhead bytes injected by the build pipeline into the app's
/// compiled asset bundle. Falls back gracefully when unconfigured.
Future<Uint8List?> _loadEmbeddedLetterhead() async {
  try {
    final data = await rootBundle.load(LETTERHEAD_ASSET);
    return data.buffer.asUint8List();
  } catch (_) {
    return null; // blank canvas fallback (dev environment)
  }
}
