import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:signature/signature.dart';

import '../core/pdf_output.dart' show finalizeLetter;
import '../data/letter_store.dart';
import 'preview_screen.dart';

/// Form Capture Fields (PRD 3.3): To, Date, Salutation, Body + the Vector
/// Signature Pad capturing gesture paths as a transparent graphic layer.
class EditorScreen extends StatefulWidget {
  const EditorScreen({super.key, this.draft});

  final LetterDraft? draft; // non-null → editing an existing draft

  @override
  State<EditorScreen> createState() => _EditorScreenState();
}

class _EditorScreenState extends State<EditorScreen> {
  late final LetterDraft _draft;
  late final TextEditingController _toController;
  late final TextEditingController _dateController;
  late final TextEditingController _salutationController;
  late final TextEditingController _bodyController;
  late String _paperFormat;

  late SignatureController _signatureController;
  Uint8List? _signatureBytes;
  bool _padDirty = false; // true once the user touches/clears the pad
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final draft = widget.draft;
    _draft = draft ??
        LetterDraft(
          id: DateTime.now().millisecondsSinceEpoch.toString(),
          createdAt: DateTime.now().millisecondsSinceEpoch,
        );
    final now = DateTime.now();
    _toController = TextEditingController(text: _draft.to);
    _dateController = TextEditingController(
      text: _draft.date.isEmpty
          ? '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}'
          : _draft.date,
    );
    _salutationController = TextEditingController(
      text: _draft.salutation.isEmpty ? 'Dear Sir/Madam,' : _draft.salutation,
    );
    _bodyController = TextEditingController(text: _draft.body);
    _paperFormat = _draft.paperFormat;
    _signatureBytes = _draft.signatureBytes;
    _signatureController = SignatureController(
      penStrokeWidth: 3,
      penColor: const Color(0xFF0A0A0A),
      exportBackgroundColor: Colors.transparent,
      exportPenColor: const Color(0xFF0A0A0A),
    );
    _signatureController.addListener(() {
      if (!_padDirty) _padDirty = _signatureController.isNotEmpty;
      setState(() {}); // reflect pad content in UI affordances
    });
  }

  @override
  void dispose() {
    _toController.dispose();
    _dateController.dispose();
    _salutationController.dispose();
    _bodyController.dispose();
    _signatureController.dispose();
    super.dispose();
  }

  Future<void> _syncControlsIntoDraft() async {
    _draft
      ..to = _toController.text
      ..date = _dateController.text
      ..salutation = _salutationController.text
      ..body = _bodyController.text
      ..paperFormat = _paperFormat;

    if (_signatureController.isEmpty) {
      // Cleared (or never drawn) this session: drop the signature only if the
      // user actively erased a previously loaded one.
      if (_padDirty) {
        _signatureBytes = null;
        _draft.signatureBytes = null;
      }
      return;
    }
    final png = await _signatureController.toPngBytes();
    if (png != null) {
      _signatureBytes = png;
      _draft.signatureBytes = png;
    }
  }

  /// Generate read-only PDF, save to private app documents, then hand off to
  /// the preview/exports screen.
  Future<void> _generateAndPreview() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await _syncControlsIntoDraft();
      final store = await LetterStore.instance();
      final finished = await finalizeLetter(_draft, store);
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(builder: (_) => PreviewScreen(letter: finished)),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not generate PDF: $e'),
            backgroundColor: Colors.red.shade700),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _saveDraftOnly() async {
    await _syncControlsIntoDraft();
    final store = await LetterStore.instance();
    await store.save(_draft);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Draft saved on this device')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161616),
        title: const Text('Compose Letter',
            style: TextStyle(color: Colors.white)),
        iconTheme: const IconThemeData(color: Color(0xFFD4AF37)),
        actions: [
          PopupMenuButton<String>(
            tooltip: 'Paper size',
            initialValue: _paperFormat,
            icon: const Icon(Icons.aspect_ratio, color: Color(0xFFD4AF37)),
            onSelected: (v) => setState(() => _paperFormat = v),
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'A4', child: Text('A4 paper')),
              PopupMenuItem(value: 'Letter', child: Text('US Letter paper')),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _field(_dateController, 'Date'),
            const SizedBox(height: 12),
            _field(_toController, 'To (Recipient)',
                maxLines: 2),
            const SizedBox(height: 12),
            _field(_salutationController, 'Salutation'),
            const SizedBox(height: 12),
            _field(_bodyController, 'Letter body',
                maxLines: 9, alignLabelWithHint: true),
            const SizedBox(height: 20),
            Row(
              children: [
                Text('Signature',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFE4E4E4).withValues(alpha: 0.9))),
                const Spacer(),
                TextButton.icon(
                  onPressed: () => _signatureController.clear(),
                  icon: const Icon(Icons.restart_alt,
                      size: 16, color: Color(0xFFD4AF37)),
                  label: const Text('Clear pad',
                      style: TextStyle(color: Color(0xFFD4AF37))),
                ),
              ],
            ),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFF2A2A2A)),
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(12),
                child: Signature(
                  controller: _signatureController,
                  height: 150,
                  backgroundColor: Colors.white,
                ),
              ),
            ),
            if (_saving)
              const LinearProgressIndicator(
                color: Color(0xFFD4AF37),
                backgroundColor: Color(0xFF2A2A2A),
              ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFFD4AF37),
                  foregroundColor: const Color(0xFF0A0A0A),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  disabledBackgroundColor: const Color(0xFF6B6B6B),
                ),
                onPressed: _saving ? null : _generateAndPreview,
                child: Text(_saving
                    ? 'Building PDF…'
                    : 'Generate & Save Letter  ($_paperFormat)'),
              ),
            ),
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFE4E4E4),
                  side: const BorderSide(color: Color(0xFF2A2A2A)),
                ),
                onPressed: _saving ? null : _saveDraftOnly,
                child: const Text('Save draft (no PDF yet)'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(    TextEditingController controller,
    String label, {
    int maxLines = 1,
    bool alignLabelWithHint = false,
  }) {
    return TextField(
      controller: controller,
      maxLines: maxLines,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        alignLabelWithHint: alignLabelWithHint,
        labelText: label,
        labelStyle: const TextStyle(color: Color(0xFF8A8A8A)),
        filled: true,
        fillColor: const Color(0xFF161616),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF2A2A2A)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFF2A2A2A)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Color(0xFFD4AF37)),
        ),
      ),
    );
  }
}
