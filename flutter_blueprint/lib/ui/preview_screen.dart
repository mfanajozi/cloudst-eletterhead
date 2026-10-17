import 'dart:io' show File;
import 'dart:typed_data';

import 'package:flutter/foundation.dart'
    show kIsWeb, defaultTargetPlatform, TargetPlatform;
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart' show PdfPageFormat;
import 'package:printing/printing.dart';

import '../core/brand.dart';
import '../core/pdf_output.dart' show sharePdf;
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

  /// Android + iOS get the native share sheet (email, WhatsApp, drive …);
  /// web/desktop rely on the PDF viewer's built-in print/save actions.
  bool get _hasNativeShare {
    if (kIsWeb) return false;
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
      case TargetPlatform.iOS:
        return true;
      default:
        return false;
    }
  }

  Future<void> _shareLetter(BuildContext context) async {
    try {
      await sharePdf(
        subject: 'Letter ${letter.date} · $APP_NAME',
        filePath: letter.pdfPath,
        bytes: letter.pdfBytes,
        fileName: 'Letter_${letter.id}.pdf',
      );
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not share: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161616),
        iconTheme: const IconThemeData(color: Color(0xFFD4AF37)),
        actions: [
          if (_hasNativeShare)
            IconButton(
              icon: const Icon(Icons.ios_share),
              tooltip: 'Share letter',
              onPressed: () => _shareLetter(context),
            ),
        ],
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
