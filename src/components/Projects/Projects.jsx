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
    <div className='mx-auto flex w-full max-w-5xl flex-col gap-8 rounded-3xl bg-black px-4 pb-16 pt-8 text-white shadow-2xl sm:px-6'>
      <header className='space-y-3 text-center sm:text-left'>
        <p className='text-xs uppercase tracking-[0.2em] text-white/50'>Manage</p>
        <h1 className='text-3xl font-semibold sm:text-[2.3rem]'>Projects</h1>
        <p className='text-sm text-white/60'>Create new initiatives, open timers, and track daily totals from a single place.</p>
      </header>

      <form onSubmit={handleAdd} className='flex flex-col gap-5 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950 via-black to-slate-900 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur'>
        <div className='grid gap-4 lg:grid-cols-2'>
          <label className='flex flex-col gap-2 text-sm text-white/70'>
            <span className='text-xs uppercase tracking-[0.18em] text-white/50'>Project name</span>
            <input
              className='rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-base text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none'
              placeholder='e.g. Client Website Redesign'
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className='flex flex-col gap-2 text-sm text-white/70'>
            <span className='text-xs uppercase tracking-[0.18em] text-white/50'>Description (optional)</span>
            <textarea
              className='min-h-[100px] rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none'
              rows={3}
              placeholder="What are you tracking? (e.g. client work, personal goal)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
        <div className='flex flex-wrap items-center justify-end gap-3'>
          <span className='text-xs uppercase tracking-[0.18em] text-white/40'>Projects auto-sync locally</span>
          <button className='tt-button tt-button-primary min-w-[160px]' type='submit'>Create project</button>
        </div>
      </form>

      <section className='space-y-4'>
        {projects.length === 0 && (
          <p className='rounded-2xl border border-dashed border-white/15 bg-black/40 px-4 py-6 text-center text-sm text-white/60'>
            No projects yet. Create your first one above.
          </p>
        )}
        {projects.map(p => (
          <article key={p.id} className='flex flex-col gap-4 rounded-2xl border border-white/10 bg-black/70 p-5 shadow-lg hover:border-white/20 transition-colors sm:flex-row sm:items-center sm:justify-between'>
            <div className='space-y-1'>
              <Link to={`/projects/${p.id}`} className='text-lg font-semibold text-white hover:text-white/80'>
                {p.name}
              </Link>
              {p.description && <p className='text-sm text-white/50'>{p.description}</p>}
            </div>
            <div className='flex flex-wrap items-center gap-3 text-sm font-medium text-white/70'>
              <span className='rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-base text-white'>
                {formatDuration(p.totalMs || 0)}
              </span>
              <Link className='tt-button tt-button-primary' to={`/projects/${p.id}`}>Open</Link>
              <button className='tt-button tt-button-outline' onClick={() => handleDelete(p.id)}>Delete</button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};

export default Projects;
