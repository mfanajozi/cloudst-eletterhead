import 'dart:io' show File;
import 'dart:typed_data';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:printing/printing.dart';

import '../core/brand.dart';
import '../data/letter_store.dart';

/// Read-only PDF output view with native system exports: printing & sharing
/// are built into PdfPreview's action bar (PRD 3.3 — no intermediate servers).
class PreviewScreen extends StatelessWidget {
  const PreviewScreen({
    super.key,
    required this.letter,
    this.pdfBytes,
  });

  final LetterDraft letter;
  final Uint8List? pdfBytes; // in-memory bytes straight from the generator

  Future<Uint8List> _loadBytes() async {
    // In-memory bytes straight from the generator (or persisted with the
    // record). The web build has no file system — dart:io's File stubs throw
    // 'Unsupported operation: _Namespace' the moment they are touched — so
    // reading from disk is strictly a native-platform path.
    final given = pdfBytes ?? letter.pdfBytes;
    if (given != null) return given;
    final path = letter.pdfPath;
    if (kIsWeb || path == null) {
      throw StateError(
          'PDF bytes not available on this device. Re-generate the letter '
          'from the editor to refresh it.');
    }
    return File(path).readAsBytes(); // native platforms only
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161616),
        iconTheme: const IconThemeData(color: Color(0xFFD4AF37)),
        title: Text(
          'Letter · ${letter.date}  ·  $APP_NAME',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(color: Colors.white, fontSize: 15),
        ),
      ),
      body: FutureBuilder<Uint8List>(
        future: _loadBytes(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Could not open this letter:\n${snapshot.error}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF8A8A8A)),
                ),
              ),
            );
          }
          if (!snapshot.hasData) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFFD4AF37)),
            );
          }
          final bytes = snapshot.data!;
          return PdfPreview(
            initialPageFormat: letter.paperFormat == 'Letter'
                ? PdfPageFormat.letter
                : PdfPageFormat.a4,
            build: (_) => bytes,
            canChangePageFormat: false,
            pdfPreviewPageDecoration: const BoxDecoration(color: Color(0xFF161616)),
          );
        },
      ),
    );
  }
}
