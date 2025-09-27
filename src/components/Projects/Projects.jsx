import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addProject, getProjects, formatDuration, deleteProject } from '../../services/storage';

const Projects = () => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tick, setTick] = useState(0); // simple rerender trigger after changes

  const projects = useMemo(() => getProjects(), [tick]);

  const handleAdd = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    addProject({ name: trimmed, description: description.trim() });
    setName('');
    setDescription('');
    setTick(t => t + 1);
  };

  const handleDelete = (id) => {
    if (confirm('Delete this project?')) {
      deleteProject(id);
      setTick(t => t + 1);
    }
  };

  return (
    <div className='max-w-4xl mx-auto p-4'>
      <h1 className='text-2xl font-semibold mb-4'>Projects</h1>

      <form onSubmit={handleAdd} className='card mb-6 space-y-3'>
        <div>
          <label className='label'>Project name</label>
          <input
            className='input'
            placeholder='e.g. Client Website Redesign'
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label className='label'>Description (optional)</label>
          <textarea
            className='textarea'
            rows={2}
            placeholder='Short note'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <button className='btn btn-primary' type='submit'>Add Project</button>
      </form>

      <div className='space-y-3'>
        {projects.length === 0 && (
          <p className='text-neutral-500'>No projects yet. Add one above.</p>
        )}
        {projects.map(p => (
          <div key={p.id} className='card flex items-center justify-between'>
            <div>
              <Link to={`/projects/${p.id}`} className='text-primary-600 font-medium hover:underline'>
                {p.name}
              </Link>
              {p.description && <p className='text-sm text-neutral-400'>{p.description}</p>}
            </div>
            <div className='flex items-center gap-3'>
              <span className='text-neutral-300 font-mono'>{formatDuration(p.totalMs || 0)}</span>
              <Link className='btn btn-primary' to={`/projects/${p.id}`}>Open</Link>
              <button className='nav-link' onClick={() => handleDelete(p.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Projects;
