import json
from typing import List, Dict, Any, Tuple
from app.services.pdf_processor import PDFProcessor
from app.services.pdf_security import PDFSecurity
from app.services.pdf_converter import PDFConverter

class WorkflowEngine:
    """
    Executes sequential processing pipelines.
    Passes output from one step as the input to the next step.
    """

    @staticmethod
    def execute_pipeline(
        input_files: List[Tuple[str, bytes]],
        steps: List[Dict[str, Any]]
    ) -> Tuple[bytes, str, List[str]]:
        """
        Executes a sequence of steps on input documents.
        Returns: (final_bytes, final_filename, execution_logs)
        """
        if not input_files:
            raise ValueError("No input files provided to workflow.")

        logs = []
        # Current working binary
        current_data = input_files[0][1]
        current_name = input_files[0][0]

        logs.append(f"Workflow initialized with primary file: {current_name}")

        for idx, step in enumerate(steps):
            action = step.get("tool_action", "").lower()
            params_raw = step.get("parameters_json") or "{}"
            params = json.loads(params_raw) if isinstance(params_raw, str) else params_raw

            logs.append(f"Executing step {idx + 1}: {action}")

            if action == "merge":
                all_bytes = [f[1] for f in input_files]
                current_data = PDFProcessor.merge_pdfs(all_bytes)
                current_name = "merged_workflow.pdf"
                logs.append(f"Merged {len(all_bytes)} files.")

            elif action == "compress":
                level = params.get("level", "recommended")
                current_data = PDFProcessor.compress_pdf(current_data, level=level)
                logs.append(f"Compressed document (profile: {level}).")

            elif action == "watermark":
                text = params.get("text", "CONFIDENTIAL")
                opacity = float(params.get("opacity", 0.3))
                current_data = PDFSecurity.add_watermark(current_data, text=text, opacity=opacity)
                logs.append(f"Applied watermark: '{text}'.")

            elif action == "page_numbers":
                pos = params.get("position", "bottom-center")
                current_data = PDFProcessor.add_page_numbers(current_data, position=pos)
                logs.append(f"Added page numbers at {pos}.")

            elif action == "rotate":
                angle = int(params.get("angle", 90))
                current_data = PDFProcessor.rotate_pages(current_data, angle=angle)
                logs.append(f"Rotated pages by {angle} degrees.")

            elif action == "protect":
                password = params.get("password", "")
                if password:
                    current_data = PDFSecurity.protect_pdf(current_data, user_password=password)
                    logs.append("Encrypted document with password.")

            elif action == "convert_to_docx":
                current_data = PDFConverter.pdf_to_docx(current_data)
                current_name = current_name.rsplit(".", 1)[0] + ".docx"
                logs.append("Converted document to DOCX.")

            else:
                logs.append(f"Skipping unrecognized action: {action}")

        logs.append("Workflow execution completed successfully.")
        return current_data, f"workflow_result_{current_name}", logs

workflow_engine = WorkflowEngine()
