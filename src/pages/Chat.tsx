import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  AtSign, Check, Hash, MessageCircle, Pencil, Reply, Send,
  ShieldCheck, Smile, Trash2, Users, X, Zap,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { LoadingState } from '@/components/ui/EmptyState';

type ChatChannel = {
  id: string;
  name: string;
  description: string | null;
  department_id: string | null;
  is_general: boolean;
};
type ChatPerson = {
  id: string;
  full_name: string;
  designation: string | null;
  avatar_url: string | null;
  status?: string;
};
type ChatMessage = {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  mentioned_user_ids: string[];
  reply_to: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
};
type ChatReaction = {
  id: string;
  channel_id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

const EMOJIS = ['😀', '😂', '😍', '🥹', '🔥', '👏', '🙌', '🎉', '❤️', '💯', '👀', '✅', '🚀', '🤝', '🙏', '😅', '🤔', '💡', '👍', '👎'];
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '🚀'];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}
function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function formatDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function Chat() {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reactions, setReactions] = useState<ChatReaction[]>([]);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [emojiMenuFor, setEmojiMenuFor] = useState<string | null>(null);
  const [showComposerEmoji, setShowComposerEmoji] = useState(false);
  const [mentionMatches, setMentionMatches] = useState<ChatPerson[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedChannel = channels.find(channel => channel.id === selectedChannelId) || null;
  const personMap = useMemo(() => new Map(people.map(person => [person.id, person])), [people]);
  const messageMap = useMemo(() => new Map(messages.map(message => [message.id, message])), [messages]);

  useEffect(() => {
    let alive = true;
    async function initialise() {
      setLoading(true);
      setError('');
      const [channelResult, peopleResult] = await Promise.all([
        supabase.from('chat_channels').select('id, name, description, department_id, is_general').order('is_general', { ascending: false }).order('name'),
        supabase.from('profiles').select('id, full_name, designation, avatar_url, status').eq('status', 'active').order('full_name'),
      ]);
      if (!alive) return;
      if (channelResult.error) {
        setError('Chat is not set up in Supabase yet. Run the included chat migration SQL, then refresh this page.');
        setLoading(false);
        return;
      }
      const loadedChannels = (channelResult.data || []) as ChatChannel[];
      setChannels(loadedChannels);
      setPeople((peopleResult.data || []) as ChatPerson[]);
      setSelectedChannelId(current => current && loadedChannels.some(channel => channel.id === current) ? current : loadedChannels[0]?.id || null);
      setLoading(false);
    }
    void initialise();
    return () => { alive = false; };
  }, []);

  async function loadChannelMessages(channelId: string) {
    const [messageResult, reactionResult] = await Promise.all([
      supabase.from('chat_messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: false }).limit(150),
      supabase.from('chat_reactions').select('*').eq('channel_id', channelId),
    ]);
    if (messageResult.error || reactionResult.error) {
      setError('Could not load chat messages. Check the chat table permissions and try refreshing.');
      return;
    }
    setError('');
    setMessages(((messageResult.data || []) as ChatMessage[]).reverse());
    setReactions((reactionResult.data || []) as ChatReaction[]);
  }

  useEffect(() => {
    if (!selectedChannelId) return;
    setMessages([]);
    setReactions([]);
    void loadChannelMessages(selectedChannelId);
    const messageSubscription = supabase.channel(`pulse-chat-messages-${selectedChannelId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${selectedChannelId}` }, () => {
        void loadChannelMessages(selectedChannelId);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reactions', filter: `channel_id=eq.${selectedChannelId}` }, () => {
        void loadChannelMessages(selectedChannelId);
      })
      .subscribe();
    return () => { void supabase.removeChannel(messageSubscription); };
  }, [selectedChannelId]);

  useEffect(() => {
    if (!profile?.id) return;
    const presence = supabase.channel('jic-yuva-pulse-chat-presence', { config: { presence: { key: profile.id } } });
    presence.on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(presence.presenceState()).length));
    presence.subscribe(async status => {
      if (status === 'SUBSCRIBED') {
        await presence.track({ user_id: profile.id, full_name: profile.full_name, online_at: new Date().toISOString() });
      }
    });
    return () => { void supabase.removeChannel(presence); };
  }, [profile?.id, profile?.full_name]);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length, selectedChannelId]);

  function handleDraftChange(value: string) {
    setDraft(value);
    const match = value.match(/(?:^|\s)@([^\s@]*)$/);
    if (!match) {
      setMentionMatches([]);
      return;
    }
    const query = match[1].toLowerCase();
    setMentionMatches(people.filter(person => person.id !== profile?.id && person.full_name.toLowerCase().includes(query)).slice(0, 6));
  }

  function insertMention(person: ChatPerson) {
    const match = draft.match(/(?:^|\s)@([^\s@]*)$/);
    const start = match ? draft.length - match[0].length : draft.length;
    setDraft(`${draft.slice(0, start)}@${person.full_name} `);
    setMentionMatches([]);
    textareaRef.current?.focus();
  }

  function addEmoji(emoji: string) {
    setDraft(current => `${current}${emoji}`);
    setShowComposerEmoji(false);
    setMentionMatches([]);
    textareaRef.current?.focus();
  }

  function collectMentions(content: string) {
    return people.filter(person => person.id !== profile?.id && content.includes(`@${person.full_name}`)).map(person => person.id);
  }

  async function submitMessage(event?: FormEvent) {
    event?.preventDefault();
    if (!profile || !selectedChannelId || !draft.trim() || busy) return;
    const content = draft.trim();
    setBusy(true);
    setError('');
    setNotice('');
    if (editMessageId) {
      const { error: updateError } = await supabase.from('chat_messages').update({
        content,
        mentioned_user_ids: collectMentions(content),
        edited_at: new Date().toISOString(),
      }).eq('id', editMessageId).eq('sender_id', profile.id);
      if (updateError) setError(`Could not edit message: ${updateError.message}`);
      else {
        setDraft('');
        setEditMessageId(null);
        setNotice('Message updated.');
      }
    } else {
      const { error: insertError } = await supabase.from('chat_messages').insert({
        channel_id: selectedChannelId,
        sender_id: profile.id,
        content,
        mentioned_user_ids: collectMentions(content),
        reply_to: replyTo?.id || null,
      });
      if (insertError) setError(`Could not send message: ${insertError.message}`);
      else {
        setDraft('');
        setReplyTo(null);
        setNotice('');
      }
    }
    setMentionMatches([]);
    setShowComposerEmoji(false);
    setBusy(false);
    textareaRef.current?.focus();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
    if (event.key === 'Escape') {
      setMentionMatches([]);
      setShowComposerEmoji(false);
      setReplyTo(null);
      if (editMessageId) {
        setEditMessageId(null);
        setDraft('');
      }
    }
  }

  async function toggleReaction(messageId: string, emoji: string) {
    if (!profile || !selectedChannelId) return;
    const current = reactions.find(reaction => reaction.message_id === messageId && reaction.user_id === profile.id && reaction.emoji === emoji);
    if (current) {
      const { error: deleteError } = await supabase.from('chat_reactions').delete().eq('id', current.id).eq('user_id', profile.id);
      if (deleteError) setError(`Could not remove reaction: ${deleteError.message}`);
    } else {
      const { error: insertError } = await supabase.from('chat_reactions').insert({ channel_id: selectedChannelId, message_id: messageId, user_id: profile.id, emoji });
      if (insertError) setError(`Could not add reaction: ${insertError.message}`);
    }
    setEmojiMenuFor(null);
  }

  function startEdit(message: ChatMessage) {
    setEditMessageId(message.id);
    setDraft(message.content);
    setReplyTo(null);
    setNotice('Editing your message. Press Escape to cancel.');
    textareaRef.current?.focus();
  }

  async function deleteMessage(message: ChatMessage) {
    if (!profile || !window.confirm('Delete this message?')) return;
    const { error: deleteError } = await supabase.from('chat_messages').update({ deleted_at: new Date().toISOString() }).eq('id', message.id);
    if (deleteError) setError(`Could not delete message: ${deleteError.message}`);
  }

  function renderContent(content: string) {
    const names = people.map(person => person.full_name).filter(Boolean).sort((a, b) => b.length - a.length);
    if (!names.length) return content;
    const matcher = new RegExp(`(@(?:${names.map(escapeRegex).join('|')}))`, 'g');
    return content.split(matcher).map((piece, index) => piece.startsWith('@') && names.includes(piece.slice(1))
      ? <span key={`${piece}-${index}`} className="rounded bg-jic-blue-pale px-1 font-semibold text-jic-blue">{piece}</span>
      : piece);
  }

  if (loading) return <LoadingState message="Opening Pulse Chat..." />;

  return (
    <div className="max-w-[1600px] mx-auto space-y-4 animate-fade-in">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-jic-orange uppercase tracking-wide">JIC YUVA PULSE</p>
          <h1 className="text-3xl font-bold text-jic-text mt-1">Pulse Chat</h1>
          <p className="text-jic-text-secondary mt-1">One workspace for updates, quick decisions, and team conversations.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-jic-border bg-white px-3 py-2 text-sm text-jic-text-secondary">
          <span className="h-2 w-2 rounded-full bg-emerald-500" /> {onlineCount} online
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>}
      {notice && !error && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</div>}
      {!error && channels.length === 0 ? <div className="rounded-2xl border border-jic-border bg-white p-10 text-center"><MessageCircle className="mx-auto h-10 w-10 text-jic-orange" /><h2 className="mt-3 font-bold text-jic-text">Your chat workspace is ready to be created</h2><p className="mx-auto mt-2 max-w-lg text-sm text-jic-text-secondary">Run the included Supabase chat migration to create the General room, department rooms, secure message tables, reactions, and live updates.</p></div> : channels.length > 0 && (
        <div className="grid h-[calc(100vh-13.5rem)] min-h-[520px] grid-cols-1 overflow-hidden rounded-2xl border border-jic-border bg-white shadow-sm md:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-jic-border bg-slate-50 md:border-b-0 md:border-r">
            <div className="border-b border-jic-border px-4 py-4">
              <div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-jic-orange text-white"><MessageCircle className="h-5 w-5" /></div><div><p className="font-bold text-jic-text">JIC Community</p><p className="text-xs text-jic-text-secondary">Team messaging</p></div></div>
            </div>
            <div className="flex items-center justify-between px-4 pb-2 pt-4"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Channels</p><span className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-500">{channels.length}</span></div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3">
              {channels.map(channel => <button key={channel.id} onClick={() => { setSelectedChannelId(channel.id); setReplyTo(null); setEditMessageId(null); setDraft(''); setNotice(''); }} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${selectedChannelId === channel.id ? 'bg-jic-orange text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-jic-text'}`}><Hash className="h-4 w-4 shrink-0 opacity-80" /><span className="truncate">{channel.name}</span>{selectedChannelId === channel.id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />}</button>)}
            </nav>
            <div className="border-t border-jic-border p-3"><div className="flex items-center gap-2 rounded-xl bg-white p-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-jic-blue-pale text-xs font-bold text-jic-blue">{initials(profile?.full_name || 'YU')}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-jic-text">{profile?.full_name || 'JIC member'}</p><p className="flex items-center gap-1 text-xs text-emerald-700"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active</p></div><ShieldCheck className="h-4 w-4 text-slate-400" /></div></div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col">
            <header className="flex items-center justify-between gap-3 border-b border-jic-border px-4 py-3.5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-jic-orange-pale text-jic-orange"><Hash className="h-5 w-5" /></div><div className="min-w-0"><h2 className="truncate font-bold text-jic-text">{selectedChannel?.name || 'Choose a channel'}</h2><p className="truncate text-xs text-jic-text-secondary">{selectedChannel?.description || 'A shared space for JIC updates and discussion.'}</p></div></div>
              <div className="hidden items-center gap-2 text-xs text-jic-text-secondary sm:flex"><Users className="h-4 w-4" /> {people.length} active members</div>
            </header>

            <div ref={listRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
              {messages.length === 0 ? <div className="flex h-full min-h-48 flex-col items-center justify-center text-center"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-jic-orange-pale text-jic-orange"><Zap className="h-7 w-7" /></div><h3 className="mt-4 font-bold text-jic-text">Make the first move</h3><p className="mt-1 max-w-sm text-sm text-jic-text-secondary">Start the conversation. Share an update, ask for help, or tag a teammate with @.</p></div> : messages.map((message, index) => {
                const author = personMap.get(message.sender_id);
                const parent = message.reply_to ? messageMap.get(message.reply_to) : undefined;
                const previous = messages[index - 1];
                const showDay = !previous || formatDay(previous.created_at) !== formatDay(message.created_at);
                const grouped = previous && previous.sender_id === message.sender_id && !showDay && new Date(message.created_at).getTime() - new Date(previous.created_at).getTime() < 5 * 60 * 1000;
                const groupedReactions = reactions.filter(reaction => reaction.message_id === message.id).reduce<Record<string, { count: number; mine: boolean }>>((acc, reaction) => { acc[reaction.emoji] ||= { count: 0, mine: false }; acc[reaction.emoji].count += 1; if (reaction.user_id === profile?.id) acc[reaction.emoji].mine = true; return acc; }, {});
                return <div key={message.id}>
                  {showDay && <div className="my-2 flex items-center gap-3"><div className="h-px flex-1 bg-slate-100" /><span className="rounded-full border border-slate-100 bg-white px-3 py-1 text-[11px] font-semibold text-slate-400">{formatDay(message.created_at)}</span><div className="h-px flex-1 bg-slate-100" /></div>}
                  <article className={`group relative flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-slate-50 ${grouped ? 'mt-0.5' : 'mt-2'}`}>
                    {grouped ? <div className="w-9 shrink-0 pt-1 text-center text-[10px] text-slate-300 opacity-0 group-hover:opacity-100">{formatTime(message.created_at)}</div> : <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-jic-blue-pale text-xs font-bold text-jic-blue">{initials(author?.full_name || 'YU')}</div>}
                    <div className="min-w-0 flex-1">
                      {!grouped && <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"><span className="text-sm font-bold text-jic-text">{author?.full_name || 'Former member'}</span>{author?.designation && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">{author.designation}</span>}<time className="text-[11px] text-slate-400">{formatTime(message.created_at)}</time>{message.edited_at && <span className="text-[10px] text-slate-400">edited</span>}</div>}
                      {message.reply_to && <div className="mt-1 border-l-2 border-jic-orange/40 pl-2 text-xs text-slate-500">Replying to {parent ? (personMap.get(parent.sender_id)?.full_name || 'a member') : 'an earlier message'}: {parent?.deleted_at ? 'Message deleted' : parent?.content?.slice(0, 110) || 'Original message is no longer available'}</div>}
                      {message.deleted_at ? <p className="mt-1 text-sm italic text-slate-400">This message was deleted.</p> : <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">{renderContent(message.content)}</p>}
                      {Object.keys(groupedReactions).length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(groupedReactions).map(([emoji, item]) => <button key={emoji} onClick={() => void toggleReaction(message.id, emoji)} title={item.mine ? 'Remove your reaction' : 'React'} className={`rounded-full border px-2 py-1 text-xs transition-colors ${item.mine ? 'border-jic-blue/30 bg-jic-blue-pale' : 'border-slate-200 bg-white hover:bg-slate-100'}`}>{emoji} <span className="ml-1 text-slate-600">{item.count}</span></button>)}</div>}
                    </div>
                    {!message.deleted_at && <div className="absolute right-2 top-0 hidden items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-sm group-hover:flex">
                      <button onClick={() => { setReplyTo(message); setEditMessageId(null); setDraft(''); textareaRef.current?.focus(); }} aria-label="Reply" title="Reply" className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-jic-blue"><Reply className="h-3.5 w-3.5" /></button>
                      <button onClick={() => setEmojiMenuFor(current => current === message.id ? null : message.id)} aria-label="Add reaction" title="Add reaction" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Smile className="h-3.5 w-3.5" /></button>
                      {message.sender_id === profile?.id && <button onClick={() => startEdit(message)} aria-label="Edit message" title="Edit message" className="rounded p-1.5 text-slate-500 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /></button>}
                      {(message.sender_id === profile?.id || profile?.role === 'admin') && <button onClick={() => void deleteMessage(message)} aria-label="Delete message" title="Delete message" className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>}
                    {emojiMenuFor === message.id && <div className="absolute right-2 top-8 z-20 flex max-w-[260px] flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">{QUICK_REACTIONS.map(emoji => <button key={emoji} onClick={() => void toggleReaction(message.id, emoji)} className="rounded-lg p-2 text-lg hover:bg-slate-100">{emoji}</button>)}<button onClick={() => setEmojiMenuFor(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div>}
                  </article>
                </div>;
              })}
            </div>

            <div className="relative border-t border-jic-border bg-white p-3 sm:p-4">
              {mentionMatches.length > 0 && <div className="absolute bottom-[calc(100%-0.25rem)] left-4 z-30 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">{mentionMatches.map(person => <button key={person.id} onMouseDown={event => event.preventDefault()} onClick={() => insertMention(person)} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-jic-muted"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-jic-blue-pale text-xs font-bold text-jic-blue">{initials(person.full_name)}</div><div className="min-w-0"><p className="truncate text-sm font-semibold text-jic-text">{person.full_name}</p><p className="truncate text-xs text-jic-text-secondary">{person.designation || 'JIC member'}</p></div><AtSign className="ml-auto h-4 w-4 text-slate-300" /></button>)}</div>}
              {showComposerEmoji && <div className="absolute bottom-full left-4 z-30 mb-2 grid w-[260px] grid-cols-5 gap-1 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">{EMOJIS.map(emoji => <button key={emoji} onClick={() => addEmoji(emoji)} className="rounded-lg p-2 text-xl hover:bg-slate-100">{emoji}</button>)}</div>}
              {replyTo && <div className="mb-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><Reply className="h-4 w-4 text-jic-orange" /><span className="min-w-0 flex-1 truncate text-slate-600">Replying to <strong>{personMap.get(replyTo.sender_id)?.full_name || 'member'}</strong>: {replyTo.content.slice(0, 100)}</span><button onClick={() => setReplyTo(null)} className="rounded p-1 text-slate-400 hover:bg-slate-200"><X className="h-3.5 w-3.5" /></button></div>}
              {editMessageId && <div className="mb-2 flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><Pencil className="h-3.5 w-3.5" /> Editing message <button onClick={() => { setEditMessageId(null); setDraft(''); setNotice(''); }} className="ml-auto rounded p-1 hover:bg-amber-100"><X className="h-3.5 w-3.5" /></button></div>}
              <form onSubmit={event => void submitMessage(event)} className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 focus-within:border-jic-blue/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-jic-blue/10">
                <button type="button" onClick={() => setShowComposerEmoji(current => !current)} title="Add emoji" aria-label="Add emoji" className={`mb-0.5 rounded-xl p-2.5 transition-colors ${showComposerEmoji ? 'bg-jic-orange-pale text-jic-orange' : 'text-slate-500 hover:bg-slate-200'}`}><Smile className="h-5 w-5" /></button>
                <textarea ref={textareaRef} value={draft} onChange={event => handleDraftChange(event.target.value)} onKeyDown={handleComposerKeyDown} rows={1} maxLength={4000} placeholder={editMessageId ? 'Edit your message…' : `Message #${selectedChannel?.name || 'general'} — use @ to tag someone`} className="max-h-32 min-h-10 flex-1 resize-y bg-transparent px-1 py-2 text-sm text-jic-text outline-none placeholder:text-slate-400" />
                <button type="submit" disabled={busy || !draft.trim()} title={editMessageId ? 'Save edit' : 'Send message'} className="mb-0.5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-jic-orange px-3.5 text-sm font-semibold text-white transition-colors hover:bg-jic-orange-deep disabled:cursor-not-allowed disabled:opacity-40">{editMessageId ? <Check className="h-4 w-4" /> : <Send className="h-4 w-4" />}<span className="hidden sm:inline">{editMessageId ? 'Save' : 'Send'}</span></button>
              </form>
              <div className="flex items-center justify-between px-1 pt-2 text-[10px] text-slate-400"><span>Enter to send · Shift + Enter for a new line · @ to mention teammates</span><span>{draft.length}/4000</span></div>
            </div>
          </section>
        </div>
      )}
      <p className="text-center text-xs text-jic-text-secondary">Live messages · Department channels · Emoji reactions · Mentions · Replies · Edit and delete</p>
    </div>
  );
}
