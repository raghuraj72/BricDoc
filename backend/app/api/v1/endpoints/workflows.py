import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.storage import storage
from app.api.v1.endpoints.auth import get_current_user
from app.models.user import User
from app.models.workflow import Workflow, WorkflowStep, WorkflowExecution
from app.schemas.workflow import WorkflowCreate, WorkflowOut, WorkflowExecutionOut
from app.services.workflow_engine import workflow_engine

router = APIRouter()

@router.post("", response_model=WorkflowOut, status_code=status.HTTP_201_CREATED)
def create_workflow(
    wf_in: WorkflowCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create and save a reusable multi-step document workflow."""
    wf = Workflow(
        user_id=current_user.id,
        name=wf_in.name,
        description=wf_in.description
    )
    db.add(wf)
    db.flush()

    for step_in in wf_in.steps:
        step = WorkflowStep(
            workflow_id=wf.id,
            order_index=step_in.order_index,
            tool_action=step_in.tool_action,
            parameters_json=step_in.parameters_json
        )
        db.add(step)

    db.commit()
    db.refresh(wf)
    return wf

@router.get("", response_model=List[WorkflowOut])
def list_workflows(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all saved workflows owned by user."""
    return db.query(Workflow).filter(Workflow.user_id == current_user.id).all()

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workflow(
    workflow_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a workflow."""
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == current_user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    db.delete(wf)
    db.commit()
    return None

@router.post("/{workflow_id}/run")
async def run_workflow(
    workflow_id: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Execute a workflow against uploaded documents."""
    wf = db.query(Workflow).filter(
        Workflow.id == workflow_id,
        Workflow.user_id == current_user.id
    ).first()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found.")

    input_data = []
    for f in files:
        data = await f.read()
        input_data.append((f.filename or "doc.pdf", data))

    steps_dict = [
        {"tool_action": s.tool_action, "parameters_json": s.parameters_json}
        for s in wf.steps
    ]

    try:
        final_bytes, final_name, logs = workflow_engine.execute_pipeline(input_data, steps_dict)
        
        # Save execution record
        exec_record = WorkflowExecution(
            workflow_id=wf.id,
            status="completed",
            output_file_name=final_name,
            input_file_names=", ".join([f[0] for f in input_data])
        )
        db.add(exec_record)
        db.commit()

        return Response(
            content=final_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{final_name}"',
                "X-Workflow-Logs": json.dumps(logs)
            }
        )
    except Exception as e:
        exec_record = WorkflowExecution(
            workflow_id=wf.id,
            status="failed",
            error_message=str(e),
            input_file_names=", ".join([f[0] for f in input_data])
        )
        db.add(exec_record)
        db.commit()
        raise HTTPException(status_code=400, detail=f"Workflow execution failed: {str(e)}")
